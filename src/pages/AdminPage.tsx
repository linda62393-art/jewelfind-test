import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Aftercare, FollowupQueue } from '../components/Aftercare'
import { RequestTools } from '../components/RequestTools'
import { InventorySearch } from '../components/InventorySearch'
import { requestColors } from '../services/aftercare'
import { purposeOptions, categoryOptions, materialOptions, budgetOptions, styleOptions } from '../configs/matching'
const answerLabel = (options: { value: string; label: string }[], value: string) => options.find(o => o.value === value)?.label || value
import { adminClient, choices, deadline, failures, rpc, stages, time, today, type AdminDetail, type RequestRow } from '../services/phase6'

const input = 'mt-2 min-h-12 w-full rounded-xl border border-champagne-300 bg-white p-3'
const button = 'min-h-12 rounded-xl bg-champagne-700 px-5 py-3 text-white disabled:opacity-50'
export function AdminPage() {
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const check = async () => {
      try { const { data } = await adminClient.auth.getSession(); const allowed = data.session ? await rpc<boolean>(true, 'is_jewelfind_admin') : false; if (active) { setAuthorized(allowed); if (data.session && !allowed) setError('此帳號尚未獲得管理員授權。') } }
      catch { if (active) { setAuthorized(false); setError('無法驗證管理員登入，請重新登入。') } } finally { if (active) setChecking(false) }
    }
    void check()
    const { data } = adminClient.auth.onAuthStateChange(() => { window.setTimeout(() => void check(), 0) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget)
    const { error: authError } = await adminClient.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) })
    if (authError) setError('登入失敗，請確認 Email、密碼及帳號設定。')
    setBusy(false)
  }
  return <main className="min-h-dvh bg-ivory px-5 py-8 text-ink"><div className="mx-auto max-w-6xl"><header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link to="/" className="text-sm text-champagne-700">← JEWELFIND</Link><h1 className="mt-3 font-serif text-3xl">看貨媒合管理</h1><p className="mt-2 text-sm text-ink/60">雙北試營運 · 管理商品安排與客戶看貨意願</p></div>{authorized && <button className="text-champagne-700" onClick={() => void adminClient.auth.signOut()}>登出管理員</button>}</header>
    {checking ? <p>驗證管理員權限中…</p> : authorized ? <AdminWorkspace /> : <form onSubmit={login} className="mx-auto max-w-md space-y-5 rounded-3xl bg-white p-7"><h2 className="font-serif text-2xl">管理員登入</h2><p className="text-sm leading-7 text-ink/60">僅限已授權的管理員帳號。此頁不提供註冊或寄送登入信。</p><label className="block">Email<input name="email" type="email" autoComplete="username" required className={input} /></label><label className="block">密碼<input name="password" type="password" autoComplete="current-password" required className={input} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className={`${button} w-full`}>{busy ? '登入中…' : '登入'}</button></form>}
  </div></main>
}

function AdminWorkspace() {
  const [workspace, setWorkspace] = useState<'requests' | 'inventory'>('requests')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState({ search: '', stage: '', region: '', page: 0, archived: false, sort: 'newest' })
  const [rows, setRows] = useState<RequestRow[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<AdminDetail | null>(null)
  const detailGeneration = useRef(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const listGeneration = useRef(0)
  const load = useCallback(async () => {
    const generation = ++listGeneration.current; setLoading(true)
    try { const result = await rpc<{ items: RequestRow[]; total: number }>(true, 'admin_requests_v8', { p_search: query.search, p_stage: query.stage, p_region: query.region, p_page: query.page, p_archived: query.archived, p_sort: query.sort }); if (generation !== listGeneration.current) return; if (query.page > 0 && query.page * 6 >= result.total) { setQuery(q => ({ ...q, page: Math.max(0, Math.ceil(result.total / 6) - 1) })); return }; setRows(result.items); setTotal(result.total); setError('') }
    catch (e) { if (generation === listGeneration.current) setError((e as Error).message) } finally { if (generation === listGeneration.current) setLoading(false) }
  }, [query])
  const loadDetail = useCallback(async () => { const generation = ++detailGeneration.current; if (!selected) return; try { const result = await rpc<AdminDetail>(true, 'admin_request', { p_id: selected }); if (generation === detailGeneration.current) { setDetail(result); setError('') } } catch (e) { if (generation === detailGeneration.current) setError((e as Error).message) } }, [selected])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setDetail(null); void loadDetail() }, [loadDetail])
  async function archive(row: RequestRow) {
    if (loading) return; setLoading(true); setNotice('')
    try { await rpc(true, 'admin_archive_request', { p_id: row.id, p_version: row.meta_version, p_archived: !row.archived }); if (selected === row.id) { setSelected(''); setDetail(null) }; setRevision(v => v + 1); setNotice(row.archived ? '需求已復原。' : '需求已從清單移除；可勾選「查看已刪除需求」復原，安排未取消。'); await load() }
    catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }
  async function refresh() { setRevision(v => v + 1); await Promise.all([load(), loadDetail()]) }
  return <><nav aria-label="後台功能" className="mb-6 flex flex-wrap gap-3"><button onClick={() => setWorkspace('requests')} aria-pressed={workspace === 'requests'} className={`min-h-12 rounded-xl border px-5 py-3 ${workspace === 'requests' ? 'border-champagne-700 bg-champagne-700 text-white' : 'border-champagne-300 bg-white text-champagne-700'}`}>看貨需求管理</button><button onClick={() => setWorkspace('inventory')} aria-pressed={workspace === 'inventory'} className={`min-h-12 rounded-xl border px-5 py-3 ${workspace === 'inventory' ? 'border-champagne-700 bg-champagne-700 text-white' : 'border-champagne-300 bg-white text-champagne-700'}`}>商品查詢（SKU／型號）</button></nav><div hidden={workspace !== 'inventory'}>{workspace === 'inventory' && <InventorySearch />}</div><div hidden={workspace !== 'requests'}><details className="mb-5 rounded-xl border border-champagne-300 p-4"><summary className="min-h-11 cursor-pointer text-champagne-700">看貨後追蹤待辦（展開）</summary><FollowupQueue revision={revision} select={id => { setNotice(''); setSelected(id) }} /></details><div className="mb-4 flex flex-wrap items-center gap-3 text-sm"><span>底色依進度區分；取消、無法調貨、未赴店與未購買各自保留紀錄。</span><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={query.archived} onChange={e => { setSelected(''); setDetail(null); setQuery({ ...query, page: 0, archived: e.target.checked }) }} />查看已刪除需求</label></div><form onSubmit={e => { e.preventDefault(); detailGeneration.current++; setSelected(''); setDetail(null); const f = new FormData(e.currentTarget); setQuery({ search: String(f.get('search')), stage: String(f.get('stage')), region: String(f.get('region')), page: 0, archived: query.archived, sort: query.sort }) }} className="mb-6 grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-4"><label>姓名或手機<input name="search" maxLength={100} className={input} /></label><label>處理狀態<select name="stage" className={input}><option value="">全部狀態</option>{Object.entries(stages).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>排序<select value={query.sort} onChange={e => { setSelected(''); setQuery({ ...query, page: 0, sort: e.target.value }) }} className={input}><option value="newest">最新需求優先</option><option value="oldest">最舊需求優先</option><option value="updated">最近更新優先</option><option value="stage">依處理進度</option></select></label><label>看貨地區<input name="region" maxLength={100} placeholder="例如：台北市" className={input} /></label><button className={`${button} self-end`} disabled={loading}>搜尋／重新整理</button></form>
    {error && <p role="alert" className="my-4 text-red-700">{error}</p>}
    {notice && <p role="status" className="my-4 rounded-xl bg-champagne-100 p-3 text-sm">{notice}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]"><section><p className="mb-3 text-sm text-ink/60">共 {total} 筆需求（每頁六筆）{loading && ' · 讀取中…'}</p><div className="space-y-3">{rows.map(row => <article key={row.id} className="space-y-1"><button onClick={() => { setNotice(''); setSelected(row.id) }} className={`w-full rounded-2xl border p-4 text-left ${requestColors[row.stage] || 'bg-white'} ${selected === row.id ? 'border-champagne-700 ring-2 ring-champagne-300' : 'border-champagne-300'}`}><p className="flex justify-between gap-2"><b>{row.display_label || row.name}{row.is_test && <span className="ml-2 text-xs">測試</span>}</b><span className="text-sm text-champagne-700">{row.reply === 'yes' && row.stage === 'arrived' ? '待看貨' : stages[row.stage]}</span></p><p className="mt-2 text-sm">{row.phone} · {row.viewing_region}</p><p className="mt-2 font-serif">{row.selected_product_name}</p><p className="mt-2 text-xs text-ink/60">{time(row.created_at)}</p>{row.reply && <p className="mt-2 text-sm text-rose-400">客戶：{choices[row.reply]}</p>}</button><div className="flex gap-3"><button disabled={loading} onClick={() => void archive(row)} className="min-h-11 px-3 text-sm text-red-700">{row.archived ? '復原需求' : '刪除'}</button><button onClick={() => { setSelected(row.id); setNotice('開啟「整理／刪除這筆需求」可改名與標記測試。') }} className="min-h-11 px-3 text-sm text-champagne-700">編輯／整理</button></div></article>)}</div><div className="mt-4 flex justify-between"><button disabled={!query.page} onClick={() => setQuery({ ...query, page: query.page - 1 })}>上一頁</button><span>{query.page + 1}／{Math.max(1, Math.ceil(total / 6))}</span><button disabled={(query.page + 1) * 6 >= total} onClick={() => setQuery({ ...query, page: query.page + 1 })}>下一頁</button></div></section>
      {detail ? <Detail key={`${detail.request.id}:${detail.fulfillment.version}`} data={detail} refresh={refresh} setNotice={setNotice} /> : <p className="rounded-2xl bg-white p-8">{selected ? '讀取需求中…' : '選擇一筆需求開始處理。'}</p>}
    </div></div></>
}

function Detail({ data, refresh, setNotice }: { data: AdminDetail; refresh: () => Promise<void>; setNotice: (message: string) => void }) {
  const { request: r, fulfillment: f } = data
  const original = r.submission_fingerprint
  const [stage, setStage] = useState(f.stage)
  const [message, setMessage] = useState('')
  const [arrivalDate, setArrivalDate] = useState(f.arrived_on || today())
  const [endDate, setEndDate] = useState(f.viewing_deadline || deadline(today()))
  const [photo, setPhoto] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function showPhoto() {
    setPhotoError(''); const path = r.reference_photo_url?.split('/reference-photos/')[1]
    if (!path) return
    const { data: signed, error: e } = await adminClient.storage.from('reference-photos').createSignedUrl(path, 300)
    if (e) setPhotoError('無法載入私人照片，請確認登入後重試。'); else setPhoto(signed.signedUrl)
  }
  async function process(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice(''); const fields = new FormData(event.currentTarget)
    try { await rpc(true, 'admin_process_request', { p_id: r.id, p_version: f.version, p_stage: stage, p_fields: Object.fromEntries(fields), p_note: fields.get('note') || '' }); setNotice('處理結果已儲存；通知紀錄請見下方。'); await refresh() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await rpc(true, 'admin_publish_notification', { p_id: r.id, p_version: f.version, p_message: message.trim() })
      setMessage(''); setNotice('App 通知已發佈，客戶開啟看貨進度頁即可查看。')
      await refresh()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="space-y-6 rounded-3xl bg-white p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-2xl">{r.selected_product_name}</h2><p className="mt-2 break-all text-xs text-ink/50">{r.id}</p></div><button onClick={() => void refresh()} className="text-sm text-champagne-700">重新整理</button></div>
    <details><summary className="min-h-11 cursor-pointer text-champagne-700">查這件商品的寄售店家／同款商品</summary><InventorySearch key={r.selected_product_id} initialSearch={r.selected_product_id} /></details>
    <RequestTools key={r.id} requestId={r.id} onChange={() => void refresh()} />
    <section className="rounded-2xl bg-ivory p-4 text-sm leading-7"><h3 className="font-medium">客戶原始需求（唯讀）</h3><p>提交：{time(r.created_at)}</p><p>姓名：{original.name} / 手機：{original.phone}</p><p>LINE：{original.line_id || '未提供'} / 所在地：{original.region}</p><p>希望看貨地區：{r.viewing_region}</p><p>原始希望時間：{time(r.preferred_viewing_time)}</p><p>用途：{answerLabel(purposeOptions, r.purpose)} / 類別：{answerLabel(categoryOptions, r.category)}</p><p>材質：{r.material_preferences.map(v => answerLabel(materialOptions, v)).join('、') || '不限'}</p><p>預算：{answerLabel(budgetOptions, r.budget)} / 風格：{answerLabel(styleOptions, r.style)}</p><p>第 5 題：{r.reference_photo_url ? '已上傳參考照片' : '未上傳照片／直接找尋'}</p><p className="mt-2 text-ink/60">客戶目前聯絡資料：{data.customer.name}／{data.customer.phone}／{data.customer.line_id || '未提供 LINE'}／{data.customer.region}</p>{r.reference_photo_url && <button type="button" onClick={() => void showPhoto()} className="mt-3 text-champagne-700">載入／重新載入私人參考照片（5 分鐘有效）</button>}{photoError && <p role="alert">{photoError}</p>}{photo && <img src={photo} alt="客戶上傳的私人珠寶參考照片" className="mt-3 max-h-80 rounded-xl object-contain" />}</section>
    <section className="text-sm leading-7"><h3 className="font-medium">目前安排</h3><p>{stages[f.stage]} · 來源合作店家：{f.partner_store || '尚未確認'}</p>{f.arrived_on && <p>到店：{f.arrived_on}／期限：{f.viewing_deadline} 23:59<br />看貨店家：{f.viewing_store}<br />地址：{f.store_address}</p>}{f.failure_detail && <p className="mt-2 text-red-700">最近無法調貨原因（僅內部）：{failures[f.failure_code || '']}／{f.failure_detail}</p>}</section>
    <p className="text-xs leading-6 text-ink/60">「商品已售出」指原商品已無法提供；本次成交請在客人看貨後選「客戶已購買」。未赴店請在確認客人未到店後登記。調貨進度不會代你聯絡店家。</p><form onSubmit={process} className="space-y-4 border-t border-champagne-300 pt-5"><h3 className="font-serif text-xl">處理需求／內部備註</h3><p className="text-sm leading-6 text-ink/60">直接選目前實際進度，填必要資料後儲存一次即可；未登記的中間步驟不會自動產生紀錄。</p><label className="block text-sm">更新處理狀態<select value={stage} onChange={e => setStage(e.target.value)} className={input}><option value={f.stage}>保留目前狀態，新增備註</option>{Object.keys(stages).filter(s => s !== f.stage && s !== 'new').map(s => <option value={s} key={s}>{s === 'checking' && ['arrived', 'unavailable', 'cancelled', 'sold', 'viewed', 'purchased', 'not_purchased', 'no_show'].includes(f.stage) ? '重新確認／重新安排' : stages[s]}</option>)}</select></label>
      {['notified', 'transferring', 'in_transit'].includes(stage) && stage !== f.stage && <label className="block text-sm">來源合作店家 *<input name="partner_store" defaultValue={f.partner_store} maxLength={200} required className={input} /></label>}
      {stage === 'unavailable' && stage !== f.stage && <><label className="block text-sm">內部無法調貨原因 *<select name="failure_code" required className={input}>{Object.entries(failures).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label className="block text-sm">完整真實原因（不向客戶公開）*<textarea name="failure_detail" required maxLength={2000} className={input} /></label><p className="text-xs text-ink/60">儲存後只發佈適合客戶的固定 App 通知，不會顯示內部原因。</p></>}
      {(stage === 'arrived' || (['viewed', 'purchased', 'not_purchased', 'no_show'].includes(stage) && !f.arrived_on)) && stage !== f.stage && <><label className="block text-sm">實際到店日期 *<input name="arrived_on" type="date" max={today()} value={arrivalDate} onChange={e => { setArrivalDate(e.target.value); if (e.target.value) setEndDate(deadline(e.target.value)) }} required className={input} /></label><label className="block text-sm">看貨店家 *<input name="viewing_store" defaultValue={f.viewing_store} required maxLength={200} className={input} /></label><label className="block text-sm">店家地址 *<input name="store_address" defaultValue={f.store_address} required maxLength={500} className={input} /></label><label className="block text-sm">最後看貨期限 *<input name="viewing_deadline" type="date" min={arrivalDate} max={arrivalDate ? deadline(arrivalDate) : undefined} value={endDate} onChange={e => setEndDate(e.target.value)} required className={input} /></label><p className="text-xs text-ink/60">填寫實際到店安排即可，不必補登前面的調貨步驟。到店日算第 1 天，第 7 天 23:59 截止（台灣時間）。</p></>}
      <label className="block text-sm">內部備註{stage === f.stage || ['cancelled', 'sold', 'viewed', 'purchased', 'not_purchased', 'no_show'].includes(stage) || (stage === 'checking' && f.stage !== 'new') ? ' *' : ''}<textarea name="note" maxLength={2000} required={stage === f.stage || ['cancelled', 'sold', 'viewed', 'purchased', 'not_purchased', 'no_show'].includes(stage) || (stage === 'checking' && f.stage !== 'new')} className={input} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className={button}>{busy ? '儲存中…' : '儲存處理結果'}</button>
    </form>
    <section className="border-t border-champagne-300 pt-5"><h3 className="font-serif text-xl">App 通知與客戶回覆</h3><p className="mt-3 text-sm leading-7 text-ink/60">客戶開啟「我的看貨需求」的進度頁可查看通知。通知店家、運送中、到店、無法調貨、取消、已售出、看貨結果及重新安排會自動發佈 App 通知；到店後客戶才會看到看貨意願回覆選項。</p><form onSubmit={publish} className="mt-4 space-y-3"><label className="block text-sm">給客戶的通知內容 *<textarea name="customer_message" value={message} onChange={e => setMessage(e.target.value)} required maxLength={1000} placeholder="例如：我們已收到您的需求，正在確認附近的合作店家。" className={input} /></label><p className="text-xs text-ink/60">此內容會向客戶公開，請勿填寫內部備註或其他客戶資料。通知發佈於 App 內，不會自動寄送 LINE、簡訊或手機推播。</p><button disabled={busy || !message.trim()} className={button}>{busy ? '處理中…' : '發佈 App 通知'}</button></form>{!data.notifications.length && <p className="mt-3 text-sm">尚無通知</p>}{data.notifications.map(n => { const reply = data.responses.find(v => v.notification_id === n.id); return <div className="mt-3 rounded-xl bg-ivory p-4 text-sm leading-7" key={n.id}><p>{n.message}</p><p className="text-xs text-ink/60">App 已發佈：{time(n.published_at)} · {n.read_at ? `已讀：${time(n.read_at)}` : '客戶尚未讀取'}</p>{reply && <p className="mt-2 text-champagne-700">客戶回覆：{choices[reply.choice]}<br />預計日期：{reply.proposed_date || '未填寫'}<br />說明：{reply.note || '無'}<br />回覆時間：{time(reply.updated_at)}{n.id !== f.arrival_notification_id && <><br />（先前安排的回覆）</>}</p>}</div> })}</section>
    <Aftercare key={r.id} requestId={r.id} admin onChange={() => void refresh()} />
    <details><summary className="cursor-pointer text-champagne-700">內部處理紀錄（{data.activity.length}）</summary>{data.activity.map(a => <div key={a.id} className="mt-3 whitespace-pre-wrap border-t border-champagne-100 py-3 text-sm"><p>{time(a.created_at)} · {stages[a.from_stage]} → {stages[a.to_stage]}</p><p className="mt-2">{a.note || '狀態已更新'}</p></div>)}</details>
  </section>
}
