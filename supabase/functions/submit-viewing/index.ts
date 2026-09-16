import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { productNames } from '../_shared/catalog.ts'
import { imageExtension, validateSubmission } from '../_shared/validation.ts'

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
    const { data, error } = await admin.rpc('submit_viewing_request', { p_submission_key: submissionKey, p_payload: { ...payload, reference_photo_url: referencePhotoUrl } })
    if (error) {
      if (error.message.includes('rate_limited')) return respond({ error: '送出過於頻繁，請稍後再試。' }, 429)
      if (error.message.includes('invalid_time')) return respond({ error: '請選擇未來的看貨時間。' }, 400)
      if (error.message.includes('submission_conflict')) return respond({ error: '這筆需求已處理，請返回商品後重新建立需求。' }, 409)
      // Do not delete the uploaded object here: the DB may have committed despite a lost response.
      return respond({ error: '暫時無法確認送出結果，請保留表單並重試。' }, 503)
    }
    return respond(data)
  } catch {
    return respond({ error: '暫時無法處理需求，請保留表單並重試。' }, 503)
  }
})


