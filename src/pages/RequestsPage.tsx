import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { choices, rpc, savedRequests, saveRequest, stages, time, today, type CustomerRequest } from '../services/phase6'
import { mockProducts } from '../configs/products'
import { Aftercare } from '../components/Aftercare'
import { RequestProgress } from '../components/RequestProgress'
import { organizations, organizeRequest, organizedRequests, progressEvents, type Organization } from '../services/requestOrganizer'
import { requestColors } from '../services/aftercare'
import type { ViewingReceipt } from '../services/viewingService'
import { requestUrl } from '../services/deployment'

export function RequestsPage() {
  const [receipts] = useState(() => savedRequests())
  const [meta, setMeta] = useState(organizations)
  const [hidden, setHidden] = useState(false)
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState('')
  const filtered = organizedRequests(receipts, meta, hidden)
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1))
  function update(id: string, patch: Partial<Organization>) {
    const persisted = organizeRequest(id, patch)
    setMeta(organizations())
    setNotice(persisted ? patch.hidden === true ? '已從清單刪除，可在已刪除清單復原。看貨安排未取消。' : '清單已更新。' : '目前可整理清單，但此瀏覽器無法保存變更。')
  }
  return <section className="p-6"><Link to="/" className="text-sm text-champagne-700">← 返回首頁</Link><p className="mt-8 text-xs tracking-widest text-rose-400">YOUR JEWELRY JOURNEY</p><h1 className="mt-3 font-serif text-3xl">我的看貨需求</h1><p className="my-5 text-sm leading-7 text-ink/60">一筆需求、一張卡片，進度更新都留在同一筆需求內。清單名稱、釘選與刪除保存在此瀏覽器；換裝置可使用原專屬連結查看。</p><label className="mb-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={hidden} onChange={e => { setHidden(e.target.checked); setPage(0) }} />查看已刪除的需求</label>{notice && <p role="status" className="mb-4 rounded-xl bg-champagne-100 p-3 text-sm">{notice}</p>}
    {!filtered.length && <p className="rounded-2xl bg-white p-6">{hidden ? '沒有已刪除的需求。' : '此清單目前沒有需求。'}</p>}
    <div className="space-y-4">{filtered.slice(currentPage * 6, currentPage * 6 + 6).map(r => <RequestListCard key={r.id} receipt={r} meta={meta[r.id]} update={patch => update(r.id, patch)} />)}</div>{filtered.length > 6 && <div className="mt-5 flex items-center justify-between text-sm"><button className="min-h-11" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>上一頁</button><span>{currentPage + 1}／{Math.ceil(filtered.length / 6)}</span><button className="min-h-11" disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>下一頁</button></div>}
  </section>
}

function RequestListCard({ receipt, meta, update }: { receipt: ViewingReceipt; meta?: Organization; update: (patch: Partial<Organization>) => void }) {
  const [data, setData] = useState<CustomerRequest | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (receipt.accessToken) void rpc<CustomerRequest>(false, 'customer_request_v7', { p_id: receipt.id, p_token: receipt.accessToken }).then(value => { if (active) setData(value) }).catch(() => { if (active) setError('目前無法更新進度，請開啟需求後重新整理。') })
    return () => { active = false }
  }, [receipt.id, receipt.accessToken])
  const latest = data?.timeline?.[0]
  return <article className={`rounded-2xl border border-champagne-300 p-5 ${requestColors[data?.stage || 'new'] || 'bg-white'}`}><Link to={`/my-requests/${receipt.id}`} className="block"><h2 className="font-serif text-xl">{meta?.pinned && '★ '}{meta?.title || data?.productName || mockProducts.find(p => p.id === receipt.productId)?.name || '珠寶看貨需求'}</h2>{data && <p className="mt-2 text-sm text-champagne-700">{stages[data.stage]}</p>}<p className="mt-2 text-xs text-ink/60">{time(latest?.occurred_at || receipt.createdAt)}</p><p className="mt-2 text-sm leading-6">{latest?.message || '已收到您的看貨需求。'}</p><p className="mt-3 text-sm text-champagne-700">查看進度與回覆 →</p></Link>{error && <p className="mt-2 text-xs text-ink/60">{error}</p>}<details className="mt-3 border-t border-champagne-200 pt-2"><summary className="min-h-11 cursor-pointer text-sm text-champagne-700">整理這筆需求</summary><form key={meta?.title || ''} onSubmit={e => { e.preventDefault(); update({ title: String(new FormData(e.currentTarget).get('title') || '') }) }} className="space-y-3"><label className="block text-sm">清單名稱<input name="title" maxLength={100} defaultValue={meta?.title || ''} placeholder="例如：週年禮物" className="mt-2 min-h-12 w-full rounded-xl border border-champagne-300 bg-white p-3" /></label><button className="min-h-11 rounded-xl border border-champagne-300 px-4 text-sm">儲存名稱</button></form><div className="mt-3 flex flex-wrap gap-3"><button onClick={() => update({ pinned: !meta?.pinned })} className="min-h-11 rounded-xl border border-champagne-300 px-4 text-sm">{meta?.pinned ? '取消釘選' : '釘選到最上方'}</button><button onClick={() => update({ hidden: !meta?.hidden })} className="min-h-11 rounded-xl border border-champagne-300 px-4 text-sm">{meta?.hidden ? '復原需求' : '從清單刪除（可復原）'}</button></div><p className="mt-3 text-xs leading-6 text-ink/60">刪除僅整理清單，不會取消店家安排；改時間或看貨意願請在需求內回覆。</p></details></article>
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
    try { const result = await rpc<CustomerRequest>(false, 'customer_request_v7', { p_id: requestId, p_token: token }); setData(result); setError('') }
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
    const visible = new Set(progressEvents(data.createdAt, data.timeline || data.notifications.map(n => ({ id: n.id, message: n.message, occurred_at: n.published_at, kind: n.kind }))).slice(0, 3).map(e => e.id))
    for (const n of data.notifications.filter(n => !n.read_at && visible.has(n.id))) void rpc(false, 'customer_read_notification', { p_id: data.id, p_token: token, p_notification: n.id }).catch(() => {})
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
    {data && <><article className="rounded-2xl border border-champagne-300 bg-white p-5"><h2 className="font-serif text-xl">{data.productName}</h2><p className="mt-3 text-champagne-700">{data.stage === 'arrived' && currentReply?.choice === 'yes' ? '待看貨' : stages[data.stage]}</p><p className="mt-3 text-sm text-ink/60">希望看貨時間：{time(data.preferredTime)}</p>{data.stage === 'arrived' && arrival && <dl className="mt-4 space-y-1 rounded-xl bg-ivory p-4 text-sm leading-6"><div>看貨店家：{arrival.details.store}</div><div>地址：{arrival.details.address}</div><div>到店日期：{arrival.details.arrivedOn}</div><div>看貨期限：{arrival.details.deadline} 23:59（台灣時間）</div></dl>}<RequestProgress createdAt={data.createdAt} onShowHistory={() => { for (const n of data.notifications.filter(n => !n.read_at)) void rpc(false, 'customer_read_notification', { p_id: data.id, p_token: token, p_notification: n.id }).catch(() => {}) }} events={data.timeline || data.notifications.map(n => ({ id: n.id, message: n.message, occurred_at: n.published_at, kind: n.kind }))} /></article>
      {data.stage === 'arrived' && arrival && <details open={!currentReply} className="mt-5 rounded-2xl bg-rose-50 p-4"><summary className="min-h-11 cursor-pointer text-sm text-champagne-700">{currentReply ? `看貨意願：${choices[currentReply.choice]}（可更新）` : '回覆看貨意願'}</summary><form onSubmit={reply} className="space-y-4 rounded-2xl bg-rose-50 p-5"><h2 className="font-serif text-xl">請問您是否能在未來一週內前往店家看貨？</h2><p className="text-sm">本次看貨期限：{arrival.details.deadline}，請以此日期為準。</p>{currentReply && <p className="text-sm text-champagne-700">已回覆：{choices[currentReply.choice]} {currentReply.proposed_date} {currentReply.note}</p>}{Object.entries(choices).map(([value, label]) => <label key={value} className="flex min-h-12 items-center gap-3"><input type="radio" name="choice" value={value} checked={choice === value} onChange={() => setChoice(value)} />{label}</label>)}{choice === 'reschedule' && <><label className="block text-sm">預計可前往日期（選填）<input name="date" type="date" min={today()} className="mt-2 block w-full rounded-xl border border-champagne-300 p-3" /></label><label className="block text-sm">簡單說明（選填）<textarea name="note" maxLength={1000} className="mt-2 w-full rounded-xl border border-champagne-300 p-3" /></label></>}<button disabled={busy} className="min-h-12 w-full rounded-xl bg-champagne-700 text-white disabled:opacity-50">{busy ? '儲存中…' : currentReply ? '更新我的回覆' : '送出回覆'}</button></form></details>}
      <details className="mt-5 rounded-2xl border border-champagne-300 bg-white p-4"><summary className="min-h-11 cursor-pointer text-champagne-700">填寫／查看看貨後回饋</summary><Aftercare key={requestId} requestId={requestId} token={token} revision={data.notifications.length} /></details>
      <div className="mt-8 text-xs leading-6 text-ink/55"><p>請保存專屬連結，清除瀏覽器資料或換裝置後仍可查看。持有此連結的人可查看進度及回覆，請勿公開分享。</p><button className="mt-2 min-h-11 text-champagne-700" onClick={async () => { try { await navigator.clipboard.writeText(requestUrl(window.location.origin, requestId!, token)); setNotice('專屬連結已複製，請妥善保存。') } catch { setNotice('無法自動複製，請長按下方專屬連結保存。') } }}>複製專屬需求連結</button><a className="ml-4 text-champagne-700" href={requestUrl(window.location.origin, requestId!, token)}>專屬連結</a></div>
    </>}
  </section>
}
