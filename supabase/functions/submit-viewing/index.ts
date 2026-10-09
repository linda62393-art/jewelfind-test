// Generated from the same SKU snapshot as the frontend. Only available products accept NEW requests.
export const productNames: Record<string, string> = {
  "BR00007-BR123": "Aurora Hex 極光六角鑽石手鍊",
  "BR00008-BR124": "法式優雅鑽石手鍊",
  "b-02": "光芒1克拉鑽石手環",
  "DP00008-DP220W": "Royal Heart 皇冠鑽石項鍊(白)",
  "DP00010-DP221W": "星月晨曦鑽石項鍊",
  "DP00012-DP115": "Classic Solitaire 20 Diamond Necklace｜18K Gold\n20分天然鑽石放大台單鑽項鍊｜D/VS｜18K金",
  "DP00013-DP119": "經典四爪放大單鑽墜飾｜12分天然鑽石",
  "DP00014-DP132": "3分天然鑽石愛心項鍊14K",
  "DP00015-DP136": "Dancing Diamond 跳動鑽石項鍊",
  "DP00016-DP154R": "晨曦經典 10分天然鑽石項鍊｜18K玫瑰金",
  "DP00017-DP155W": "晨曦經典 10分天然鑽石項鍊｜18K白",
  "DP00018-DP2553": "心語光芒 愛心鑽石項鍊｜18K白金",
  "DP00019-DP268": "星語流光 五鑽垂墜項鍊｜18K白金",
  "DP00020-DP57": "流光擁抱鑽石項鍊｜15分天然鑽石｜14K",
  "c-01": "銀河繁星線戒\nGalaxy Stardust Ring",
  "r-01": "雙星閃耀鑽石戒指\n(Double Star Diamond Ring)",
  "c-02": "繁星微笑鑽石戒指\n(Star Smile Diamond Ring)",
  "r-02": "流光鑽石戒指\n(Flow Diamond Ring)",
  "DR00005-DR590": "綻放花語鑽石戒指\n(Blooming Flower Diamond Ring)",
  "DR00006-DR588": "心語三重奏鑽石戒指\n(Triple Heart Diamond Ring)",
  "DR00008-RG92290": "星光鑽石排戒",
  "DR00009-DG1200": "璀璨鋪鑽寬版戒指",
  "c-04": "璀璨40分線戒",
  "DR00011-PD668": "璀璨10分線戒",
  "DR00012-PD731": "光芒50分三排鑽戒",
  "DR00013-PD614": "光采30分經典鑽戒",
  "r-03": "光環30分鑽戒",
  "DR00015-PD783": "星光經典六爪鑽戒",
  "DR00016-P305": "花映 Fleur｜花形光環鑽戒",
  "DR00017-PD837": "流光｜六爪鑽戒",
  "DR00018-PD773": "星繫｜半圈排鑽戒",
  "DR00019-PD774": "微光｜纖細排鑽戒",
  "DR00020-PD775": "星序｜經典排鑽戒",
  "DR00021-PD821": "漣光｜波浪排鑽戒",
  "e-01": "花語鑽石耳環\n(Floral Diamond Stud Earrings)",
  "e-02": "Tiny Spark｜18K白單鑽耳扣圈耳環",
  "ER00003-H44": "Classic Brilliance\n14K 天然鑽石耳針",
  "ER00004-H6": "Tiny Spark｜18K玫瑰金單鑽耳扣圈耳環",
  "ER00005-PB396": "心語1.5克拉滿鑽耳環",
  "c-03": "V型鑽石線戒\n(V Diamond Band)",
  "m-01": "Royal Crown 鑽石男戒",
  "MR00003-DM00458": "王者80分鑽石男戒"
}

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
      viewing_region: text(data.viewingRegion ?? customer.region, '看貨地區'), preferred_viewing_time: new Date(time).toISOString(),
    },
  }
}

export function imageExtension(bytes: Uint8Array, type: string) {
  if (bytes.length < 8 || bytes.length > 5 * 1024 * 1024) throw new Error('參考照片需小於 5 MB。')
  if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg'
  if (type === 'image/png' && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return 'png'
  throw new Error('參考照片僅接受 JPG 或 PNG。')
}

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const url = Deno.env.get('SUPABASE_URL')!
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean)

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? ''
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' }
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers })
  if (!allowedOrigins.includes(origin)) return new Response('Origin not allowed', { status: 403 })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return respond({ error: '不支援此操作。' }, 405)
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const salted = new TextEncoder().encode(`${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}:${ip}`)
    const rateKey = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', salted))).map(value => value.toString(16).padStart(2, '0')).join('')
    const admission = await admin.rpc('allow_viewing_submission', { p_key: rateKey })
    if (admission.error) return respond({ error: '服務暫時無法使用，請稍後重試。' }, 503)
    if (!admission.data) return respond({ error: '送出過於頻繁，請稍後再試。' }, 429)
    // Read with an actual byte cap, not merely a client-controlled Content-Length.
    const reader = request.body?.getReader()
    if (!reader) return respond({ error: '請填寫需求。' }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 6 * 1024 * 1024) { await reader.cancel(); return respond({ error: '參考照片需小於 5 MB。' }, 413) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData()
    const raw = form.get('payload')
    if (typeof raw !== 'string' || raw.length > 10000) return respond({ error: '需求格式不正確。' }, 400)
    let validated
    try { validated = validateSubmission(JSON.parse(raw), productNames) }
    catch (error) { return respond({ error: error instanceof Error && !(error instanceof SyntaxError) ? error.message : '需求格式不正確。' }, 400) }
    const { submissionKey, payload } = validated
    const accessToken = JSON.parse(raw).accessToken
    if (accessToken !== undefined && (typeof accessToken !== 'string' || !/^[a-f0-9]{64}$/.test(accessToken))) return respond({ error: '需求存取憑證格式不正確。' }, 400)
    let referencePhotoUrl: string | null = null
    const photo = form.get('photo')
    if (photo instanceof File && photo.size > 0) {
      const photoBytes = new Uint8Array(await photo.arrayBuffer())
      let extension
      try { extension = imageExtension(photoBytes, photo.type) }
      catch (error) { return respond({ error: (error as Error).message }, 400) }
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', photoBytes))).map(value => value.toString(16).padStart(2, '0')).join('')
      // Content-addressed retry path; never overwrite an already submitted reference.
      const path = `${submissionKey}/${digest}.${extension}`
      const { error } = await admin.storage.from('reference-photos').upload(path, photoBytes, { contentType: photo.type, upsert: false })
      if (error && String(error.statusCode) !== '409') return respond({ error: '照片上傳失敗，請保留表單並重試。' }, 503)
      // Stable PRIVATE authenticated URL, never a public bucket or expiring signed URL.
      referencePhotoUrl = `${url}/storage/v1/object/authenticated/reference-photos/${path}`
    }
    const { data, error } = await admin.rpc(accessToken ? 'submit_viewing_request_v6' : 'submit_viewing_request', { p_submission_key: submissionKey, p_payload: { ...payload, reference_photo_url: referencePhotoUrl }, ...(accessToken ? { p_access_token: accessToken } : {}) })
    if (error) {
      if (error.message.includes('viewing_request_limit')) return respond({ error: '你目前已有 3 筆處理中的看貨需求。為節省商品調度時間並維持服務量能，請先完成看貨或聯繫平台取消現有需求，再新增商品。', code: 'viewing_request_limit' }, 409)
      if (error.message.includes('unsupported_viewing_region')) return respond({ error: '雙北試營運目前僅提供台北市、新北市看貨媒合，請重新選擇看貨地區。' }, 400)
      if (error.message.includes('rate_limited')) return respond({ error: '送出過於頻繁，請稍後再試。' }, 429)
      if (error.message.includes('invalid_time')) return respond({ error: '請選擇未來的看貨時間。' }, 400)
      if (error.message.includes('submission_conflict')) return respond({ error: '這筆需求已處理，請返回商品後重新建立需求。' }, 409)
      // Do not delete the uploaded object here: the DB may have committed despite a lost response.
      return respond({ error: '暫時無法確認送出結果，請保留表單並重試。' }, 503)
    }
    // The request has been saved. Email delivery must not change the customer's result.
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      try {
        const message = [
          'JEWELFIND 收到新的看貨需求，請登入 Supabase 確認並聯絡客人。',
          `需求識別碼：${submissionKey}`,
          `姓名：${payload.name}`,
          `手機：${payload.phone}`,
          `LINE ID：${payload.line_id || '未提供'}`,
          `商品：${payload.selected_product_name}`,
          `看貨地區：${payload.viewing_region}`,
          `希望時間：${new Date(payload.preferred_viewing_time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}（台灣時間）`,
          '',
          '這是新需求通知，客人的希望時間尚未完成預約。',
        ].join('\n')
        const mail = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `viewing-request/${submissionKey}`,
          },
          body: JSON.stringify({
            from: 'JEWELFIND <alerts@notify.jewelfind.tw>',
            to: ['linda62393@gmail.com'],
            subject: 'JEWELFIND｜收到新的看貨需求',
            text: message,
          }),
          signal: AbortSignal.timeout(8000),
        })
        if (!mail.ok) console.error('Viewing notification email rejected', { status: mail.status, submissionKey })
      } catch (mailError) {
        console.error('Viewing notification email failed', { submissionKey, error: String(mailError) })
      }
    } else {
      console.error('Viewing notification email unavailable: RESEND_API_KEY missing')
    }
    return respond(data)
  } catch {
    return respond({ error: '暫時無法處理需求，請保留表單並重試。' }, 503)
  }
})
