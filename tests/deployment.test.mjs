import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import ts from 'typescript'
import { parsePath } from 'react-router'

async function load(path, mode, base) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replaceAll('import.meta.env.MODE', JSON.stringify(mode))
    .replaceAll('import.meta.env.BASE_URL', JSON.stringify(base))
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

test('Pages capability links survive hash routing without sending the token to the server', async () => {
  const { requestUrl } = await load('../src/services/deployment.ts', 'pages', '/jewelfind-test/')
  const url = new URL(requestUrl('https://example.test', 'request-1', 'test-token'))
  assert.equal(url.pathname, '/jewelfind-test/')
  assert.equal(url.search, '')
  const location = parsePath(url.hash.slice(1))
  assert.equal(location.pathname, '/my-requests/request-1')
  assert.equal(new URLSearchParams(location.hash.slice(1)).get('key'), 'test-token')
})
test('Local request links retain the original browser-router format', async () => {
  const { requestUrl } = await load('../src/services/deployment.ts', 'development', '/')
  assert.equal(requestUrl('http://localhost:4173', 'id', 'token'), 'http://localhost:4173/my-requests/id#key=token')
})
test('Every Pages product image uses the subpath and references an existing public asset', async () => {
  const { mockProducts } = await load('../src/configs/products.ts', 'pages', '/jewelfind-test/')
  for (const product of mockProducts) for (const image of product.images) {
    assert.ok(image.startsWith('/jewelfind-test/assets/'))
    assert.ok(existsSync(new URL('../public/' + decodeURIComponent(image.slice('/jewelfind-test/'.length)), import.meta.url)), image)
  }
})
