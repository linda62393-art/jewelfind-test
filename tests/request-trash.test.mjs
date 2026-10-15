import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
}
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const summaryUrl = moduleUrl(compile('../src/services/requestSummary.ts'))
const source = compile('../src/services/requestTrash.ts').replace("'./requestSummary'", JSON.stringify(summaryUrl))
const { cancelBeforeTrash } = await import(moduleUrl(source))

test('moving an active request to trash cancels on the server before releasing the local card', async () => {
  let current = { stage: 'transferring', appointment: { canChange: true, version: 9 } }
  let cancellations = 0
  const api = {
    load: async () => current,
    cancel: async (version, actionId) => {
      assert.equal(version, 9)
      assert.match(actionId, /^[a-f0-9-]{36}$/)
      cancellations++
      current = { stage: 'cancelled', appointment: { canChange: false, version: 10 } }
    },
  }
  assert.equal((await cancelBeforeTrash(api)).stage, 'cancelled')
  assert.equal(cancellations, 1)
})

test('a lost cancellation response can be retried without cancelling twice', async () => {
  let current = { stage: 'new', appointment: { canChange: true, version: 1 } }
  let cancellations = 0
  const api = {
    load: async () => current,
    cancel: async () => {
      cancellations++
      current = { stage: 'cancelled', appointment: { canChange: false, version: 2 } }
      throw new Error('response lost')
    },
  }
  await assert.rejects(cancelBeforeTrash(api), /response lost/)
  assert.equal((await cancelBeforeTrash(api)).stage, 'cancelled')
  assert.equal(cancellations, 1)
})

test('completed records go to trash without changing historical results', async () => {
  for (const stage of ['viewed', 'purchased', 'cancelled', 'unavailable']) {
    const result = await cancelBeforeTrash({ load: async () => ({ stage }), cancel: async () => assert.fail('must not cancel a completed record') })
    assert.equal(result.stage, stage)
  }
})

test('a failed or unconfirmed cancellation never authorizes hiding an active record', async () => {
  const current = { stage: 'arrived', appointment: { canChange: true, version: 3 } }
  await assert.rejects(cancelBeforeTrash({ load: async () => current, cancel: async () => { throw new Error('appointment_conflict') } }), /appointment_conflict/)
  await assert.rejects(cancelBeforeTrash({ load: async () => current, cancel: async () => {} }), /尚未確認取消成功/)
  await assert.rejects(cancelBeforeTrash({ load: async () => ({ stage: 'new' }), cancel: async () => assert.fail() }), /無法確認取消權限/)
})
