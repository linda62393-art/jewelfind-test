import { useRef, useState, type FormEvent } from 'react'
import { viewingHours, viewingMinutes } from '../configs/viewing'
import { appointmentTime } from '../services/appointmentChanges'
import { rpc, time, today, type CustomerRequest } from '../services/phase6'

export function AppointmentActions({ data, token, refresh }: { data: CustomerRequest; token: string; refresh: () => Promise<void> }) {
  const [mode, setMode] = useState<'reschedule' | 'cancel' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const flight = useRef(false)
  const attempt = useRef<{ key: string; id: string; version: number } | null>(null)
  const a = data.appointment
  if (!a) return null
  const remaining = Math.max(0, a.limit - a.rescheduleCount)
  async function change(action: 'cancel' | 'reschedule', newTime: string | null) {
    if (!a || flight.current) return
    const key = `${action}:${newTime || ''}`
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID(), version: a.version }
    flight.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await rpc(false, 'customer_change_viewing', { p_id: data.id, p_token: token, p_version: attempt.current.version, p_action_id: attempt.current.id, p_action: action, p_time: newTime })
      attempt.current = null; setMode(null)
      setNotice(action === 'cancel' ? '本次看貨需求已取消。' : '改約需求已送出，待店家確認後通知；尚未完成新預約。')
      await refresh()
    } catch (e) {
      const code = (e as Error & { code?: string }).code
      if (code && ['appointment_conflict', 'appointment_retry_conflict', 'reschedule_limit', 'appointment_closed', 'appointment_unchanged', 'invalid_viewing_time', 'access_denied'].includes(code)) attempt.current = null
      setError((e as Error).message)
      await refresh()
    } finally { flight.current = false; setBusy(false) }
  }
  function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    try { void change('reschedule', appointmentTime(String(f.get('date')), String(f.get('hour')), String(f.get('minute')))) }
    catch (e) { setError((e as Error).message) }
  }
  const input = 'mt-2 min-h-12 w-full min-w-0 rounded-xl border border-champagne-300 bg-white p-3'
  return <section className="mt-5 rounded-2xl border border-champagne-300 bg-white p-5" aria-label="取消或改約看貨">
    <h2 className="font-serif text-xl">取消或改約看貨</h2>
    <p className="mt-3 text-sm leading-6">每筆需求最多改約 {a.limit} 次，已使用 {a.rescheduleCount} 次，剩餘 {remaining} 次。取消不占改約次數。</p>
    {a.requestedTime && <p className="mt-3 text-sm text-champagne-700">新的希望看貨時間：{time(a.requestedTime)}<br />{!a.canChange ? '此時間為歷史紀錄，請以目前需求狀態為準。' : a.pending ? '改約待店家確認，尚未完成新預約。' : '管理員已確認新希望時間；到店安排請以最新通知為準。'}</p>}
    {notice && <p role="status" className="mt-3 rounded-xl bg-champagne-100 p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {a.canChange ? <>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy || !remaining} onClick={() => { setMode('reschedule'); setError('') }} className="min-h-12 rounded-xl border border-champagne-300 px-4 disabled:opacity-50">改約時間</button><button type="button" disabled={busy} onClick={() => { setMode('cancel'); setError('') }} className="min-h-12 rounded-xl border border-red-200 px-4 text-red-700 disabled:opacity-50">取消看貨</button></div>
      {!remaining && <p className="mt-3 text-sm text-ink/60">已達兩次改約上限。如仍需協助，請與管理員聯繫；您仍可取消本次看貨。</p>}
      {mode === 'reschedule' && remaining > 0 && <form onSubmit={reschedule} className="mt-5 space-y-4"><p className="text-sm leading-6">請提出新的希望時間。店家須重新確認營業時間與商品安排，原看貨期限不會自動延長。</p><fieldset className="grid grid-cols-2 gap-3"><legend className="mb-2 text-sm">新的希望看貨時間</legend><label className="col-span-2 text-sm">日期<input type="date" name="date" required min={today()} className={input} /></label><label className="text-sm">小時<select name="hour" required defaultValue="" className={input}><option value="">請選擇</option>{viewingHours.map(h => <option key={h} value={h}>{h} 時</option>)}</select></label><label className="text-sm">分鐘<select name="minute" required defaultValue="" className={input}><option value="">請選擇</option>{viewingMinutes.map(m => <option key={m} value={m}>{m} 分</option>)}</select></label></fieldset><button disabled={busy} className="min-h-12 w-full rounded-xl bg-champagne-700 text-white disabled:opacity-50">{busy ? '送出中…' : `送出改約（將使用第 ${a.rescheduleCount + 1} 次）`}</button></form>}
      {mode === 'cancel' && <div className="mt-5 space-y-3"><p className="text-sm leading-6">確定取消本次看貨？取消後將停止後續預約安排；若商品已調出，管理員會協調後續處理。</p><button type="button" disabled={busy} onClick={() => void change('cancel', null)} className="min-h-12 w-full rounded-xl bg-red-700 text-white disabled:opacity-50">{busy ? '取消中…' : '確認取消本次看貨'}</button></div>}
      {mode && <button type="button" disabled={busy} onClick={() => setMode(null)} className="mt-3 min-h-11 text-sm text-champagne-700">先不變更</button>}
    </> : <p className="mt-3 text-sm text-ink/60">{data.stage === 'cancelled' ? '這筆需求已取消，不能再改約。' : '這筆需求目前無法自行取消或改約，如有需要請聯繫管理員。'}</p>}
  </section>
}
