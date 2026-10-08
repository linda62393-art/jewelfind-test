// Set OPENAI_API_KEY as a server-side secret before enabling this function.
// Quota reservations are atomic and shared between every Edge Function instance.
const origin = Deno.env.get('SITE_ORIGIN') || 'https://jewelfind.tw'
const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
const allowed = new Set(['prong', 'halo', 'bezel', 'pave', 'slim', 'wide', 'cross', 'layered', 'flower', 'heart', 'geometric', 'simple'])
const categories = new Set(['ring', 'earrings', 'necklace', 'bracelet', 'mens-ring', 'couple-ring', 'other'])
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

async function readPayload(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('missing_body')
  let total = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > 1_500_000) { await reader.cancel(); throw new Error('body_too_large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (request.headers.get('origin') !== origin) return reply({ error: 'Invalid origin' }, 403)
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return reply({ error: 'Photo analysis unavailable', code: 'key_missing' }, 503)
  // Safe connection check: returns status only, never the secret, and incurs no inference charge.
  if (request.method === 'GET') {
    try {
      const status = await fetch('https://api.openai.com/v1/models/gpt-4.1-mini', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) })
      return reply({ configured: true, providerConnected: status.ok }, status.ok ? 200 : 503)
    } catch { return reply({ configured: true, providerConnected: false }, 503) }
  }
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  if (Number(request.headers.get('content-length')) > 1_500_000) return reply({ error: 'Image too large' }, 413)
  let payload: { image?: unknown; category?: unknown }
  try { payload = await readPayload(request) } catch { return reply({ error: 'Invalid input' }, 400) }
  if (!payload || typeof payload !== 'object') return reply({ error: 'Invalid input' }, 400)
  if (typeof payload.image !== 'string' || payload.image.length > 1_400_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(payload.image) || (payload.category !== undefined && !categories.has(String(payload.category)))) return reply({ error: 'Invalid image' }, 400)
  try {
    const backend = Deno.env.get('SUPABASE_URL')
    const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!backend || !serverKey) return reply({ error: 'Photo analysis unavailable' }, 503)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
    const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(serverKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const digest = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${day}:${ip}`))
    const clientHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const reservation = await fetch(`${backend}/rest/v1/rpc/reserve_photo_analysis`, {
      method: 'POST', headers: { apikey: serverKey, Authorization: `Bearer ${serverKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_client_hash: clientHash }), signal: AbortSignal.timeout(5000),
    })
    if (!reservation.ok) return reply({ error: 'Photo analysis unavailable' }, 503)
    const quota = await reservation.json()
    if (quota?.allowed !== true) return reply({ error: 'Photo analysis limit reached', code: quota?.reason === 'quota' ? 'quota' : 'disabled' }, 429)
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini', store: false, max_output_tokens: 120,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: 'Identify ONLY clearly visible jewelry design clues in this photo. Do not guess price, material, diamond authenticity, or product identity. Return up to 4 tags. prong=prominent solitary claw set stone; halo=surrounding stones or flower cluster; bezel=metal rim around stone; pave=row of small stones; slim=thin ring band; wide=wide ring band; cross=crossing band; layered=multiple rows or V band; flower=flower motif; heart=heart motif; geometric=geometric motif; simple=minimal classic design. Category: ' + (payload.category || 'other') },
          { type: 'input_image', image_url: payload.image, detail: 'low' },
        ] }],
        text: { format: { type: 'json_schema', name: 'jewelry_features', strict: true, schema: { type: 'object', properties: { features: { type: 'array', items: { type: 'string', enum: [...allowed] } } }, required: ['features'], additionalProperties: false } } },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) {
      const failure = await response.json().catch(() => null)
      const code = failure?.error?.code === 'insufficient_quota' || failure?.error?.code === 'credit_balance_exhausted' ? 'credits_required' : response.status === 401 ? 'key_invalid' : 'provider_unavailable'
      return reply({ error: 'Analysis unavailable', code }, 503)
    }
    const result = await response.json()
    const content = result.output?.flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content || []).find((item: { type?: string }) => item.type === 'output_text')?.text
    if (typeof content !== 'string') return reply({ error: 'Analysis unavailable' }, 502)
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed.features)) return reply({ error: 'Analysis unavailable' }, 502)
    return reply({ features: [...new Set(parsed.features.filter((tag: unknown) => typeof tag === 'string' && allowed.has(tag)))].slice(0, 4) })
  } catch { return reply({ error: 'Analysis unavailable' }, 502) }
})
