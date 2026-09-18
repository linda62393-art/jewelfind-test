import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { choices, rpc, savedRequests, saveRequest, stages, time, today, type CustomerRequest } from '../services/phase6'
import { mockProducts } from '../configs/products'

export function RequestsPage() {
  const receipts = savedRequests().reverse()
  return <section className="p-6"><Link to="/" className="text-sm text-champagne-700">← 返回首頁</Link><p className="mt-8 text-xs tracking-widest text-rose-400">YOUR JEWELRY JOURNEY</p><h1 className="mt-3 font-serif text-3xl">我的看貨需求</h1><p className="my-5 text-sm leading-7 text-ink/60">在這裡查看調貨、到店通知與回覆看貨意願。此裝置僅顯示在本瀏覽器保存的需求；也可使用你保存的專屬需求連結。</p>
    {!receipts.length && <p className="rounded-2xl bg-white p-6">此瀏覽器尚無保存的需求。先前送出的資料仍保留於 JEWELFIND。</p>}
    <div className="space-y-4">{receipts.map(r => <Link key={r.id} to={`/my-requests/${r.id}`} className="block rounded-2xl border border-champagne-300 bg-white p-5"><p className="font-serif text-xl">{mockProducts.find(p => p.id === r.productId)?.name || '珠寶看貨需求'}</p><p className="mt-2 text-xs text-ink/60">{time(r.createdAt)}</p><p className="mt-4 text-sm text-champagne-700">查看最新進度與通知 →</p></Link>)}</div>
  </section>
}

export function RequestPage() {
  const { requestId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [token, setToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('key') || savedRequests().find(r => r.id === requestId)?.accessToken || '')
  const [data, setData] = useState<CustomerRequest | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [choice, setChoice] = useState('yes')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    if (!token) { setError('此裝置沒有這筆需求的存取憑證，請使用送出成功時保存的專屬連結。'); return }
    try { const result = await rpc<CustomerRequest>(false, 'customer_request', { p_id: requestId, p_token: token }); setData(result); setError('') }
    catch (e) { setError((e as Error).message) }
  }, [requestId, token])
  useEffect(() => {
    const next = new URLSearchParams(location.hash.slice(1)).get('key') || savedRequests().find(r => r.id === requestId)?.accessToken || ''
    setToken(next)
  }, [requestId, location.hash])
  useEffect(() => { void load(); const timer = window.setInterval(() => { if (!document.hidden) void load() }, 30000); window.addEventListener('focus', load); return () => { clearInterval(timer); window.removeEventListener('focus', load) } }, [load])
  useEffect(() => {
    if (!data) return
    const persisted = saveRequest({ id: data.id, productId: data.productId, preferredTime: data.preferredTime, createdAt: data.createdAt, status: 'submitted', isNewCustomer: false, accessToken: token })
    if (location.hash && persisted) navigate(location.pathname, { replace: true })
    if (!persisted) setNotice('此瀏覽器無法保存需求，請複製下方專屬連結。')
    for (const n of data.notifications.filter(n => !n.read_at)) void rpc(false, 'customer_read_notification', { p_id: data.id, p_token: token, p_notification: n.id }).catch(() => {})
  }, [data, token, location.hash, location.pathname, navigate])
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !data) return
    const fields = new FormData(event.currentTarget); setBusy(true); setNotice(''); setError('')
    try { await rpc(false, 'customer_reply', { p_id: requestId, p_token: token, p_notification: data.arrivalNotificationId, p_choice: choice, p_date: fields.get('date') || null, p_note: fields.get('note') || '' }); setNotice('回覆已送出，我們已收到你的看貨意願。'); await load() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const currentReply = data?.responses.find(r => r.notification_id === data.arrivalNotificationId)
  const arrival = data?.notifications.find(n => n.id === data.arrivalNotificationId)
  return <section className="p-6"><Link to="/my-requests" className="text-sm text-champagne-700">← 我的看貨需求</Link><h1 className="mt-8 font-serif text-3xl">看貨進度與通知</h1>
    <button onClick={() => void load()} className="my-4 min-h-11 text-sm text-champagne-700">重新整理進度 ↻</button>
    {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-champagne-100 p-4">{notice}</p>}
    {data && <><div className="rounded-2xl bg-white p-5"><h2 className="font-serif text-xl">{data.productName}</h2><p className="mt-3 text-champagne-700">{data.stage === 'arrived' && currentReply?.choice === 'yes' ? '待看貨' : stages[data.stage]}</p><p className="mt-3 text-sm text-ink/60">原始希望看貨時間：{time(data.preferredTime)}</p></div>
      <div className="my-6 space-y-4">{!data.notifications.length && <p className="text-sm leading-7 text-ink/60">需求已送出，我們正在確認商品與適合的看貨地點。最新進度將顯示在此頁。</p>}{data.notifications.map(n => <article key={n.id} className="rounded-2xl border border-champagne-300 bg-white p-5"><p className="text-xs text-rose-400">{time(n.published_at)}{n.kind === 'arrived' && n.id !== data.arrivalNotificationId ? ' · 先前安排，請以最新通知為準' : ''}</p><p className="mt-3 leading-7">{n.message}</p>{n.kind === 'arrived' && <dl className="mt-4 space-y-2 text-sm"><div>看貨店家：{n.details.store}</div><div>地址：{n.details.address}</div><div>到店日期：{n.details.arrivedOn}</div><div>最後看貨期限：{n.details.deadline} 23:59（台灣時間）</div><div className="text-xs text-ink/55">到店當日為第 1 天，共 7 個日曆日。實際售價於店家現場確認。</div></dl>}</article>)}</div>
      {data.stage === 'arrived' && arrival && <form onSubmit={reply} className="space-y-4 rounded-2xl bg-rose-50 p-5"><h2 className="font-serif text-xl">請問您是否能在未來一週內前往店家看貨？</h2><p className="text-sm">本次看貨期限：{arrival.details.deadline}，請以此日期為準。</p>{currentReply && <p className="text-sm text-champagne-700">已回覆：{choices[currentReply.choice]} {currentReply.proposed_date} {currentReply.note}</p>}{Object.entries(choices).map(([value, label]) => <label key={value} className="flex min-h-12 items-center gap-3"><input type="radio" name="choice" value={value} checked={choice === value} onChange={() => setChoice(value)} />{label}</label>)}{choice === 'reschedule' && <><label className="block text-sm">預計可前往日期（選填）<input name="date" type="date" min={today()} className="mt-2 block w-full rounded-xl border border-champagne-300 p-3" /></label><label className="block text-sm">簡單說明（選填）<textarea name="note" maxLength={1000} className="mt-2 w-full rounded-xl border border-champagne-300 p-3" /></label></>}<button disabled={busy} className="min-h-12 w-full rounded-xl bg-champagne-700 text-white disabled:opacity-50">{busy ? '儲存中…' : currentReply ? '更新我的回覆' : '送出回覆'}</button></form>}
      <div className="mt-8 text-xs leading-6 text-ink/55"><p>請保存專屬連結，清除瀏覽器資料或換裝置後仍可查看。持有此連結的人可查看進度及回覆，請勿公開分享。</p><button className="mt-2 min-h-11 text-champagne-700" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/my-requests/${requestId}#key=${token}`); setNotice('專屬連結已複製，請妥善保存。') } catch { setNotice('無法自動複製，請長按下方專屬連結保存。') } }}>複製專屬需求連結</button><a className="ml-4 text-champagne-700" href={`/my-requests/${requestId}#key=${token}`}>專屬連結</a></div>
    </>}
  </section>
}
