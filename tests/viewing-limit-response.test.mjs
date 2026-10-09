import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

test('rejected fourth request returns an actionable conflict and sends no new-request email', async () => {
  const originalDeno = globalThis.Deno
  const originalFetch = globalThis.fetch
  const originalAdmin = globalThis.viewingLimitTestAdmin
  let handler
  let emails = 0
  const calls = []
  globalThis.Deno = {
    env: { get: name => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-role', ALLOWED_ORIGINS: 'https://jewelfind.tw', RESEND_API_KEY: 'test-resend' })[name] },
    serve: callback => { handler = callback },
  }
  globalThis.viewingLimitTestAdmin = { rpc: async name => { calls.push(name); return name === 'allow_viewing_submission' ? { data: true } : { error: { message: 'viewing_request_limit' } } } }
  globalThis.fetch = async () => { emails++; throw new Error('must not send email for rejected request') }
  try {
    const source = readFileSync(new URL('../supabase/functions/submit-viewing/index.ts', import.meta.url), 'utf8').replace(/import \{ createClient \} from 'npm:@supabase\/supabase-js@[^']+'/g, 'const createClient = () => globalThis.viewingLimitTestAdmin')
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${crypto.randomUUID()}`)
    const form = new FormData()
    form.set('payload', JSON.stringify({ submissionKey: crypto.randomUUID(), accessToken: 'a'.repeat(64), productId: 'r-01', preferredTime: '2030-01-01T06:00:00Z', viewingRegion: '台北市中正區', customer: { name: '測試', phone: '0912345678', line: '', region: '台北市' }, answers: { purpose: 'self', category: 'ring', materials: ['diamond'], budget: '60000-100000', style: 'minimal' } }))
    const response = await handler(new Request('https://test.invalid/submit-viewing', { method: 'POST', headers: { Origin: 'https://jewelfind.tw' }, body: form }))
    assert.equal(response.status, 409)
    const result = await response.json()
    assert.equal(result.code, 'viewing_request_limit')
    assert.match(result.error, /3 筆/)
    assert.match(result.error, /調度時間/)
    assert.deepEqual(calls, ['allow_viewing_submission', 'submit_viewing_request_v6'])
    assert.equal(emails, 0)
  } finally {
    globalThis.Deno = originalDeno
    globalThis.fetch = originalFetch
    globalThis.viewingLimitTestAdmin = originalAdmin
  }
})
