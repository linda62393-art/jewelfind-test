import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { submitContact } from '../services/contactService'

const input = 'mt-2 min-h-14 w-full rounded-xl border border-champagne-300 bg-white px-4'

export function ContactPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const submitting = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      await submitContact(new FormData(event.currentTarget))
      setSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '暫時無法送出，請稍後重試。 / Please try again later.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return <section className="px-6 pb-10 pt-7">
    <Link to="/" className="inline-flex min-h-11 items-center text-sm text-champagne-700">← 返回首頁 / Home</Link>
    <p className="mt-6 text-xs tracking-[0.15em] text-rose-400">PARTNER WITH JEWELFIND</p>
    <h1 className="mt-3 font-serif text-3xl">店家合作／聯繫我們</h1>
    <p className="mt-2 text-sm text-ink/60">Partnership inquiries / Contact us</p>
    {sent ? <div role="status" className="mt-8 rounded-2xl bg-white p-6 leading-7"><h2 className="font-medium">訊息已送出</h2><p>Your message has been sent.</p><p className="mt-3 text-sm text-ink/60">謝謝妳／你的合作意願！我們會依留下的聯絡方式回覆。<br />Thank you for your interest. We will reply using the contact details you provided.</p><Link to="/" className="mt-5 inline-flex min-h-11 items-center text-champagne-700">返回首頁 / Back to home →</Link></div> : <>
      <p className="mt-6 text-sm leading-7 text-ink/65">想讓店裡的珠寶被更多人看見，或了解合作方式？歡迎留下訊息。<br />Interested in showcasing your jewelry or partnering with us? Send us a message.</p>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-sm">店家名稱 / Store name（選填 / Optional）<input name="store" autoComplete="organization" maxLength={120} className={input} /></label>
        <label className="block text-sm">聯絡人 / Contact name *<input name="name" autoComplete="name" required maxLength={100} className={input} /></label>
        <label className="block text-sm">電子信箱 / Email *<input name="email" type="email" autoComplete="email" required maxLength={254} className={input} /></label>
        <label className="block text-sm">電話或 LINE / Phone or LINE（選填 / Optional）<input name="phone" autoComplete="tel" maxLength={100} className={input} /></label>
        <label className="block text-sm">店家所在地 / Store location（選填 / Optional）<input name="location" autoComplete="address-level2" maxLength={120} className={input} /></label>
        <label className="block text-sm">合作需求或訊息 / Your message *<textarea name="message" required minLength={10} maxLength={4000} rows={6} className={`${input} py-3`} placeholder="請簡單介紹店家與想詢問的內容。 / Tell us about your store and inquiry." /><span className="mt-1 block text-xs text-ink/50">10–4000 字 / characters</span></label>
        <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="flex items-start gap-3 text-xs leading-6 text-ink/65"><input type="checkbox" name="consent" required className="mt-1" />我同意將以上資料提供給 JEWELFIND，用於回覆本次詢問。 / I agree to share these details with JEWELFIND so they can respond to this inquiry.</label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="min-h-14 w-full rounded-2xl bg-champagne-700 px-4 text-white disabled:opacity-50">{busy ? '送出中… / Sending…' : '送出訊息 / Send message'}</button>
      </form>
    </>}
  </section>
}
