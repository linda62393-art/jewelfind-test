import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/viewingService.ts', import.meta.url), 'utf8')
async function service(url) {
  const code = ts.transpileModule(source.replace('import.meta.env.VITE_SUPABASE_URL', JSON.stringify(url)).replace('import.meta.env.VITE_SUPABASE_ANON_KEY', JSON.stringify('test-public-anon')), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${crypto.randomUUID()}`)).viewingService
}
const input = { productId: 'r-01', preferredTime: '2030-01-01T14:00', customer: { name: 'Test', phone: '0912345678', line: '', region: '台北' } }
const answers = { purpose: 'self', category: 'ring', budget: '60000-100000', style: 'minimal', materials: ['diamond'] }
test('unconfigured backend never produces a mock success', async () => {
  await assert.rejects((await service('')).submit(input, answers), /尚未完成連線/)
})
test('uncertain retries retain key; next deliberate submission gets a new key; image included', async () => {
  const original = globalThis.fetch
  const requests = []
  const photo = new File(['test'], 'test.png', { type: 'image/png' })
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body.get('payload')))
    assert.equal(options.body.get('photo').name, 'test.png')
    if (requests.length === 1) throw new Error('lost response')
    return Response.json({ id: crypto.randomUUID(), isNewCustomer: false, status: 'submitted', productId: 'r-01', preferredTime: '2030-01-01T06:00:00Z', createdAt: '2026-09-11T00:00:00Z' })
  }
  try {
    const client = await service('https://test.invalid')
    await assert.rejects(client.submit(input, { ...answers, uploadedImage: photo }), /連線中斷/)
    await client.submit(input, { ...answers, uploadedImage: photo })
    await client.submit(input, { ...answers, uploadedImage: photo })
    assert.equal(requests[0].submissionKey, requests[1].submissionKey)
    assert.notEqual(requests[1].submissionKey, requests[2].submissionKey)
    assert.deepEqual(requests[1].answers, answers)
  } finally { globalThis.fetch = original }
})
test('backend failure is surfaced instead of showing success', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({ error: '照片上傳失敗' }, { status: 503 })
  try { await assert.rejects((await service('https://test.invalid')).submit(input, answers), /照片上傳失敗/) }
  finally { globalThis.fetch = original }
})

