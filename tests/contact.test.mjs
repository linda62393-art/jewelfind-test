import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../supabase/functions/submit-contact/handler.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { contactHandler } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const settings = { apiKey: 'test-key', from: 'JEWELFIND <contact@example.com>', recipient: 'owner@example.com', allowedOrigins: ['https://jewelfind.tw'] }
const body = { store: '珠寶店', name: '店家聯絡人', email: 'partner@example.com', phone: '', location: '', message: '想了解合作方式與商品上傳流程。', website: '', consent: true, submissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
const request = (data = body, origin = 'https://jewelfind.tw') => new Request('https://backend/submit-contact', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })

test('contact mail uses fixed recipient, safe plain text and reply-to; retries use the same key', async () => {
  const calls = []
  const handler = contactHandler(settings, { admit: async () => true, send: async (url, options) => { calls.push({ url, ...options }); return Response.json({ id: 'mail-id' }) } })
  for (let i = 0; i < 2; i++) assert.deepEqual(await (await handler(request({ ...body, to: 'attacker@example.com', message: '<script>alert(1)</script> 合作詢問' }))).json(), { sent: true })
  const mail = JSON.parse(calls[0].body)
  assert.deepEqual(mail.to, ['owner@example.com'])
  assert.equal(mail.reply_to, body.email)
  assert.ok(mail.text.includes('<script>alert(1)</script>'))
  assert.equal(mail.html, undefined)
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
})

test('invalid contact forms never invoke the email provider', async () => {
  const handler = contactHandler(settings, { admit: async () => { throw new Error('must not admit invalid form') }, send: async () => { throw new Error('must not send') } })
  for (const changes of [{ consent: false }, { email: 'invalid' }, { name: '' }, { message: 'short' }, { website: 'bot' }, { submissionId: 'invalid' }, { store: 'x'.repeat(121) }]) assert.equal((await handler(request({ ...body, ...changes }))).status, 400)
  assert.equal((await handler(request(body, 'https://untrusted.example'))).status, 403)
  assert.equal((await handler(request({ ...body, message: 'x'.repeat(25000) }))).status, 413)
})

test('mail configuration, provider failures and rate limits never produce false success', async () => {
  let calls = 0
  const send = async () => { calls++; return Response.json({ error: 'provider error' }, { status: 500 }) }
  assert.equal((await contactHandler({ ...settings, apiKey: undefined }, { admit: async () => true, send })(request())).status, 503)
  assert.equal((await contactHandler(settings, { admit: async () => false, send })(request())).status, 429)
  assert.equal(calls, 0)
  const result = await contactHandler(settings, { admit: async () => true, send })(request())
  assert.equal(result.status, 503)
  assert.notEqual((await result.json()).sent, true)
  assert.equal(calls, 1)
})
