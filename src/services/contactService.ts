let pending: { signature: string; id: string } | undefined

export async function submitContact(form: FormData) {
  const backend = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!backend || !key) throw new Error('聯絡服務尚未完成設定。 / Contact service is unavailable.')
  const fields = Object.fromEntries(['store', 'name', 'email', 'phone', 'location', 'message', 'website'].map(name => [name, String(form.get(name) ?? '').trim()]))
  const payload = { ...fields, consent: form.get('consent') === 'on' }
  const signature = JSON.stringify(payload)
  if (!pending || pending.signature !== signature) pending = { signature, id: crypto.randomUUID() }
  const attempt = pending
  let response: Response
  try {
    response = await fetch(`${backend}/functions/v1/submit-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ ...payload, submissionId: attempt.id }),
      signal: AbortSignal.timeout(30000),
    })
  } catch { throw new Error('連線中斷，請保留表單並重試。 / Connection interrupted. Please retry with this form.') }
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.sent !== true) throw new Error(result?.error ?? '無法確認寄送結果，請保留表單並重試。 / Unable to confirm delivery. Please retry.')
  if (pending === attempt) pending = undefined
}
