interface ContactSettings {
  apiKey?: string
  from?: string
  recipient: string
  allowedOrigins: string[]
}
interface ContactDependencies {
  admit: (request: Request) => Promise<boolean>
  send: typeof fetch
}

export function contactHandler(settings: ContactSettings, dependencies: ContactDependencies) {
  return async (request: Request) => {
    const origin = request.headers.get('origin') ?? ''
    if (!settings.allowedOrigins.includes(origin)) return new Response('Origin not allowed', { status: 403 })
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' }
    const respond = (body: unknown, status = 200) => Response.json(body, { status, headers })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method === 'GET') return respond({ ready: Boolean(settings.apiKey && settings.from), missingSettings: [!settings.apiKey && 'RESEND_API_KEY', !settings.from && 'CONTACT_FROM_EMAIL'].filter(Boolean) })
    if (request.method !== 'POST') return respond({ error: '不支援此操作。 / Method not allowed.' }, 405)
    if (!settings.apiKey || !settings.from) return respond({ error: '寄信服務暫時無法使用，請稍後再試。 / Email service is temporarily unavailable. Please try again later.' }, 503)
    try {
      const reader = request.body?.getReader()
      if (!reader) return respond({ error: '請填寫表單。 / Please complete the form.' }, 400)
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 24000) { await reader.cancel(); return respond({ error: '訊息過長。 / Message too long.' }, 413) }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      let body
      try { body = JSON.parse(new TextDecoder().decode(bytes)) }
      catch { return respond({ error: '表單格式不正確。 / Invalid form.' }, 400) }
      const limits: Record<string, number> = { store: 120, name: 100, email: 254, phone: 100, location: 120, message: 4000, website: 200 }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ error: '表單格式不正確。 / Invalid form.' }, 400)
      const fields: Record<string, string> = {}
      for (const [key, max] of Object.entries(limits)) {
        if (typeof body[key] !== 'string' || body[key].trim().length > max) return respond({ error: '請確認表單內容長度。 / Please check the form fields.' }, 400)
        fields[key] = body[key].trim()
      }
      if (fields.website) return respond({ error: '無法送出這份表單。 / Unable to submit this form.' }, 400)
      if (!fields.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) || fields.message.length < 10 || body.consent !== true || typeof body.submissionId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.submissionId)) return respond({ error: '請填寫姓名、有效信箱、10 字以上訊息，並勾選同意。 / Enter your name, a valid email and at least 10 characters, and check consent.' }, 400)
      if (!await dependencies.admit(request)) return respond({ error: '送出過於頻繁，請稍後重試。 / Too many requests. Please try again later.' }, 429)
      const result = await dependencies.send('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `contact/${body.submissionId}` },
        body: JSON.stringify({
          from: settings.from,
          to: [settings.recipient],
          reply_to: fields.email,
          subject: 'JEWELFIND 店家合作／聯絡詢問',
          text: `店家 / Store: ${fields.store || '未提供 / Not provided'}\n聯絡人 / Name: ${fields.name}\nEmail: ${fields.email}\n電話或 LINE / Phone or LINE: ${fields.phone || '未提供 / Not provided'}\n所在地 / Location: ${fields.location || '未提供 / Not provided'}\n\n訊息 / Message:\n${fields.message}\n\n本信來自 JEWELFIND 聯絡表單。寄件者同意提供資料供回覆本次詢問。`,
        }),
        signal: AbortSignal.timeout(20000),
      })
      const receipt = await result.json().catch(() => null)
      if (!result.ok || typeof receipt?.id !== 'string') return respond({ error: '尚未確認寄送成功，請保留表單並重試。 / Sending could not be confirmed. Please retry with this form.' }, 503)
      return respond({ sent: true })
    } catch {
      return respond({ error: '暫時無法寄送，請保留表單並重試。 / Email is temporarily unavailable. Please retry with this form.' }, 503)
    }
  }
}
