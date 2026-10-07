import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/services/matchingService.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { getDesignMatches, getRecommendations } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const product = (id, name, category = 'ring', available = true) => ({ id, name, category, available, materials: [], styleTags: [], price: 25000, description: '', specifications: '', featureTags: [], images: ['photo.jpg'] })
const products = [product('floral', '花形六爪細戒台鑽戒'), product('wide', '寬版幾何戒指'), product('earrings', '花形耳環', 'earrings'), product('sold', '花形六爪戒指', 'ring', false)]
const answers = { category: 'ring', materials: [], budget: '10000-30000', photoFeatures: ['prong', 'flower'], uploadedImage: { name: 'reference.jpg' } }

test('marked setting and design clues prioritize available products in the selected category', () => {
  assert.deepEqual(getDesignMatches(products, answers).map(item => item.id), ['floral'])
})

test('no design match still offers reference products rather than an empty result', () => {
  const noMatch = { ...answers, photoFeatures: ['bezel'] }
  assert.deepEqual(getDesignMatches(products, noMatch), [])
  assert.ok(getRecommendations(products, noMatch).length > 0)
  assert.deepEqual(getDesignMatches(products, { ...answers, uploadedImage: undefined }), [])
})
