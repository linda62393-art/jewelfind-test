export function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, '').replace(/^\+8860?/, '0').replace(/^008860?/, '0')
}
function text(value: unknown, label: string, optional = false): string {
  if (typeof value !== 'string' || value.trim().length > 100 || (!optional && !value.trim())) throw new Error(`請確認${label}。`)
  return value.trim()
}
function choice(value: unknown, allowed: string[], label: string) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`請返回問答頁完成${label}。`)
  return value
}
export function validateSubmission(raw: unknown, catalog: Record<string, string>) {
  if (!raw || typeof raw !== 'object') throw new Error('需求格式不正確。')
  const data = raw as Record<string, unknown>
  const customer = data.customer as Record<string, unknown> | undefined
  const answers = data.answers as Record<string, unknown> | undefined
  if (!customer || !answers) throw new Error('請完成聯絡資料與前面的偏好問答。')
  if (typeof data.submissionKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionKey)) throw new Error('需求識別碼不正確，請重新開啟表單。')
  const phone = normalizePhone(text(customer.phone, '手機'))
  if (!/^09\d{8}$/.test(phone)) throw new Error('請填寫有效的台灣手機號碼。')
  const productId = text(data.productId, '商品')
  if (!Object.hasOwn(catalog, productId)) throw new Error('商品不存在，請重新選擇。')
  const time = typeof data.preferredTime === 'string' ? Date.parse(data.preferredTime) : NaN
  // Future-time check is in the transaction AFTER idempotency lookup, allowing late retries.
  if (!Number.isFinite(time)) throw new Error('請選擇有效的看貨時間。')
  const materials = ['18k-yellow-gold', '18k-rose-gold', '18k-white-gold', 'platinum', 'silver', 'pearl', 'diamond', 'colored-gemstone']
  if (!Array.isArray(answers.materials) || answers.materials.length > 8 || answers.materials.some(item => typeof item !== 'string' || !materials.includes(item))) throw new Error('材質偏好不正確。')
  return {
    submissionKey: data.submissionKey,
    payload: {
      name: text(customer.name, '姓名'), phone, line_id: text(customer.line ?? '', 'LINE', true), region: text(customer.region, '所在地區'),
      purpose: choice(answers.purpose, ['birthday', 'proposal-wedding', 'anniversary', 'self', 'sister-friend', 'other'], '用途'),
      category: choice(answers.category, ['ring', 'earrings', 'necklace', 'bracelet', 'mens-ring', 'couple-ring', 'other'], '商品類別'),
      material_preferences: [...new Set(answers.materials as string[])],
      budget: choice(answers.budget, ['under-10000', '10000-30000', '30000-60000', '60000-100000', '100000-200000', '200000-500000', 'over-500000'], '預算'),
      style: choice(answers.style, ['sweet', 'refined', 'bold', 'neutral', 'designer', 'minimal', 'glamorous', 'unsure'], '風格'),
      selected_product_id: productId, selected_product_name: catalog[productId],
      viewing_region: text(customer.region, '所在地區'), preferred_viewing_time: new Date(time).toISOString(),
    },
  }
}

export function imageExtension(bytes: Uint8Array, type: string) {
  if (bytes.length < 8 || bytes.length > 5 * 1024 * 1024) throw new Error('參考照片需小於 5 MB。')
  if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg'
  if (type === 'image/png' && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return 'png'
  throw new Error('參考照片僅接受 JPG 或 PNG。')
}
