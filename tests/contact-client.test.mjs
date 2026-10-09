import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/contactService.ts', import.meta.url), 'utf8')
async function client(url = 'https://test.invalid') {
  const code = ts.transpileModule(source.replace('import.meta.env.VITE_SUPABASE_URL', JSON.stringify(url)).replace('import.meta.env.VITE_SUPABASE_ANON_KEY', JSON.stringify('test-anon')), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${crypto.randomUUID()}`)).submitContact
}
const form = () => {
  const data = new FormData()
  for (const [key, value] of Object.entries({ name: '店家', email: 'partner@example.com', message: '想詢問 JEWELFIND 合作方式', consent: 'on' })) data.set(key, value)
  return data
}

test('contact client retains the id after an uncertain response and clears it after success', async () => {
  const original = globalThis.fetch
  const requests = []
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body))
    if (requests.length === 1) throw new Error('lost response')
    return Response.json({ sent: true })
  }
  try {
    const submit = await client()
    await assert.rejects(submit(form()), /連線中斷/)
    await submit(form())
    await submit(form())
    assert.equal(requests[0].submissionId, requests[1].submissionId)
    assert.notEqual(requests[1].submissionId, requests[2].submissionId)
    assert.equal(requests[0].consent, true)
  } finally { globalThis.fetch = original }
})

test('contact client requires configured backend and explicit successful email receipt', async () => {
  await assert.rejects((await client(''))(form()), /尚未完成設定/)
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({})
    await assert.rejects((await client())(form()), /無法確認/)
    globalThis.fetch = async () => Response.json({ error: '寄信服務暫時無法使用' }, { status: 503 })
    await assert.rejects((await client())(form()), /寄信服務/)
  } finally { globalThis.fetch = original }
})
