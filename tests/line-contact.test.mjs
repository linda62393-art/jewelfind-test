import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/lineContact.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { officialLineChat, customerLineMessage, progressLineMessage } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('Official LINE draft encodes an entire capability URL without truncating hash or Chinese text', () => {
  const link = 'https://example.test/#/my-requests/request-1#key=private-example'
  const text = customerLineMessage('request-1', link)
  const url = new URL(officialLineChat(text))
  assert.equal(url.hostname, 'line.me')
  assert.equal(url.pathname, '/R/oaMessage/%40144jtspf/')
  assert.equal(decodeURIComponent(url.search.slice(1)), text)
  assert.equal(url.hash, '')
  assert.ok(text.includes(link))
})

test('Customer without a capability can still identify a request to official staff', () => {
  const text = customerLineMessage('request-2')
  assert.ok(text.includes('request-2'))
  assert.ok(!text.includes('undefined'))
  assert.ok(!text.includes('#key='))
})

test('Manual progress draft uses only explicitly supplied public text and a saved query link', () => {
  const text = progressLineMessage('request-3', '測試商品', '商品已到店。', 'https://example.test/#/my-requests/request-3#key=private-example')
  assert.ok(text.includes('商品已到店。'))
  assert.ok(text.includes('換手機'))
  assert.ok(text.includes('需求編號：request-3'))
  assert.ok(!text.includes('已送出'))
})
