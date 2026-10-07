// Set OPENAI_API_KEY as a server-side secret before enabling this function.
// Enforce a durable per-client request quota at the gateway before deploying to the public site.
const origin = Deno.env.get('SITE_ORIGIN') || 'https://jewelfind.tw'
const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
const allowed = new Set(['prong', 'halo', 'bezel', 'pave', 'slim', 'wide', 'cross', 'layered', 'flower', 'heart', 'geometric', 'simple'])
const categories = new Set(['ring', 'earrings', 'necklace', 'bracelet', 'mens-ring', 'couple-ring', 'other'])
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return reply({ error: 'Photo analysis unavailable' }, 503)
  if (Number(request.headers.get('content-length')) > 1_500_000) return reply({ error: 'Image too large' }, 413)
  let payload: { image?: unknown; category?: unknown }
  try { payload = await request.json() } catch { return reply({ error: 'Invalid input' }, 400) }
  if (typeof payload.image !== 'string' || payload.image.length > 1_400_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(payload.image) || (payload.category !== undefined && !categories.has(String(payload.category)))) return reply({ error: 'Invalid image' }, 400)
  try {
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
    if (!response.ok) return reply({ error: 'Analysis unavailable' }, 502)
    const result = await response.json()
    const content = result.output?.flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content || []).find((item: { type?: string }) => item.type === 'output_text')?.text
    const parsed = JSON.parse(content || '{}')
    return reply({ features: Array.isArray(parsed.features) ? [...new Set(parsed.features.filter((tag: unknown) => typeof tag === 'string' && allowed.has(tag)))].slice(0, 4) : [] })
  } catch { return reply({ error: 'Analysis unavailable' }, 502) }
})
