import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { contactHandler } from './handler.ts'

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const handler = contactHandler({
  apiKey: Deno.env.get('RESEND_API_KEY'),
  from: Deno.env.get('CONTACT_FROM_EMAIL') || Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM') || Deno.env.get('MAIL_FROM') || 'JEWELFIND <onboarding@resend.dev>',
  recipient: 'linda62393@gmail.com',
  allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean),
}, {
  async admit(request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${serviceKey}:contact:${ip}`))
    const rateKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const { data, error } = await admin.rpc('allow_viewing_submission', { p_key: rateKey })
    if (error) throw new Error('Rate limiter unavailable')
    return data === true
  },
  send: fetch,
})
Deno.serve(handler)
