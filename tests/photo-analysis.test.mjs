import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../supabase/functions/analyze-jewelry-photo/index.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const env = { OPENAI_API_KEY: 'fake-test-key', SUPABASE_URL: 'https://test.example', SUPABASE_SERVICE_ROLE_KEY: 'fake-test-server-key' }
let handler
globalThis.Deno = { env: { get: name => env[name] }, serve: fn => { handler = fn } }
await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const request = (body = { image: 'data:image/jpeg;base64,/9j/2Q==', category: 'ring' }, origin = 'https://jewelfind.tw') => new Request('https://test.example/functions/v1/analyze-jewelry-photo', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

test('invalid requests and a disabled or exhausted quota never call the paid provider', async () => {
  let calls = []
  globalThis.fetch = async url => { calls.push(url); return json({ allowed: false, reason: 'quota' }) }
  assert.equal((await handler(request(undefined, 'https://other.example'))).status, 403)
  assert.equal((await handler(request({ image: 'https://attacker.example/image.jpg' }))).status, 400)
  assert.equal(calls.length, 0)
  assert.equal((await handler(request())).status, 429)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].endsWith('/rpc/reserve_photo_analysis'))
})

test('analyze only after reservation; sanitize provider output and keep secrets out of results', async () => {
  let calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(url)
    if (url.includes('/rpc/')) return json({ allowed: true })
    const body = JSON.parse(options.body)
    assert.equal(body.store, false)
    assert.equal(body.model, 'gpt-4.1-mini')
    assert.equal(body.max_output_tokens, 120)
    return json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ features: ['prong', 'prong', 'unknown', 'slim'] }) }] }] })
  }
  const result = await handler(request())
  assert.deepEqual(await result.json(), { features: ['prong', 'slim'] })
  assert.equal(calls.length, 2)
})

test('payment errors return a safe actionable code and no automatic paid retries', async () => {
  let paidCalls = 0
  globalThis.fetch = async url => {
    if (url.includes('/rpc/')) return json({ allowed: true })
    paidCalls++
    return json({ error: { code: 'insufficient_quota', message: 'private provider details' } }, 429)
  }
  const result = await handler(request())
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { error: 'Analysis unavailable', code: 'credits_required' })
  assert.equal(paidCalls, 1)
})

test('unreadable or refused provider output is not reported as successful recognition', async () => {
  globalThis.fetch = async url => json(url.includes('/rpc/') ? { allowed: true } : { output: [{ content: [{ type: 'refusal' }] }] })
  assert.equal((await handler(request())).status, 502)
})
