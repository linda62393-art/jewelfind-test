import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePhone, validateSubmission, imageExtension } from '../supabase/functions/_shared/validation.ts'
import { productNames } from '../supabase/functions/_shared/catalog.ts'

const input = () => ({
  submissionKey: '11111111-1111-4111-8111-111111111111', productId: 'r-01', preferredTime: '2030-01-01T14:00:00+08:00',
  customer: { name: ' 測試 ', phone: '+886 912-345-678', line: '', region: ' 台北 ' },
  answers: { purpose: 'self', category: 'ring', materials: ['diamond', 'diamond'], budget: '60000-100000', style: 'minimal' },
})
test('Taiwan phone normalization maps international and local formats to the same key', () => {
  for (const phone of ['0912345678', '0912-345-678', '+886912345678', '+886 0912345678', '00886912345678']) assert.equal(normalizePhone(phone), '0912345678')
})
test('all five-answer fields and trusted product name are preserved', () => {
  const value = input()
  value.selected_product_name = '偽造商品名稱'
  const { payload } = validateSubmission(value, productNames)
  assert.equal(payload.phone, '0912345678')
  assert.equal(payload.name, '測試')
  assert.equal(payload.selected_product_name, productNames['r-01'])
  assert.equal(payload.purpose, 'self')
  assert.equal(payload.category, 'ring')
  assert.equal(payload.budget, '60000-100000')
  assert.equal(payload.style, 'minimal')
  assert.deepEqual(payload.material_preferences, ['diamond'])
  assert.equal(payload.viewing_region, '台北')
  assert.equal(payload.preferred_viewing_time, '2030-01-01T06:00:00.000Z')
})
test('invalid contacts, selections, dates and missing answers are rejected', () => {
  for (const change of [v => v.customer.phone = '123', v => v.customer.name = ' ', v => v.productId = '__proto__', v => delete v.answers.style, v => v.answers.materials = ['fake'], v => v.preferredTime = 'bad', v => v.submissionKey = 'bad']) {
    const value = input(); change(value); assert.throws(() => validateSubmission(value, productNames))
  }
})
test('image signatures, type and actual size are enforced', () => {
  assert.equal(imageExtension(new Uint8Array([137,80,78,71,13,10,26,10]), 'image/png'), 'png')
  assert.throws(() => imageExtension(new TextEncoder().encode('<svg>malicious</svg>'), 'image/png'))
  assert.throws(() => imageExtension(new Uint8Array(5 * 1024 * 1024 + 1), 'image/jpeg'))
})
test('server catalog accepts exactly the available SKU snapshot products', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../catalog/snapshot.json', import.meta.url), 'utf8'))
  const products = Object.values(snapshot).map(r => r.product)
  assert.deepEqual(productNames, Object.fromEntries(products.filter(p => p.available).map(p => [p.id, p.name])))
  for (const p of products.filter(p => !p.available)) {
    const value = input(); value.productId = p.id
    assert.throws(() => validateSubmission(value, productNames))
  }
})
