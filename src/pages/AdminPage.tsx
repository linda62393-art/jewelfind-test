import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { purposeOptions, categoryOptions, materialOptions, budgetOptions, styleOptions } from '../configs/matching'
const answerLabel = (options: { value: string; label: string }[], value: string) => options.find(o => o.value === value)?.label || value
import { adminClient, choices, deadline, failures, rpc, stages, time, today, transitions, type AdminDetail, type RequestRow } from '../services/phase6'

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
  const [query, setQuery] = useState({ search: '', stage: '', region: '', page: 0 })
  const [rows, setRows] = useState<RequestRow[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState('')
  const [detail, setDetail] = useState<AdminDetail | null>(null)
  const detailGeneration = useRef(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { const result = await rpc<{ items: RequestRow[]; total: number }>(true, 'admin_requests', { p_search: query.search, p_stage: query.stage, p_region: query.region, p_page: query.page }); setRows(result.items); setTotal(result.total); setError('') }
    catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [query])
  const loadDetail = useCallback(async () => { const generation = ++detailGeneration.current; if (!selected) return; try { const result = await rpc<AdminDetail>(true, 'admin_request', { p_id: selected }); if (generation === detailGeneration.current) { setDetail(result); setError('') } } catch (e) { if (generation === detailGeneration.current) setError((e as Error).message) } }, [selected])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setDetail(null); void loadDetail() }, [loadDetail])
  async function refresh() { await Promise.all([load(), loadDetail()]) }
  return <><form onSubmit={e => { e.preventDefault(); detailGeneration.current++; setSelected(''); setDetail(null); const f = new FormData(e.currentTarget); setQuery({ search: String(f.get('search')), stage: String(f.get('stage')), region: String(f.get('region')), page: 0 }) }} className="mb-6 grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-4"><label>姓名或手機<input name="search" maxLength={100} className={input} /></label><label>處理狀態<select name="stage" className={input}><option value="">全部狀態</option>{Object.entries(stages).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>看貨地區<input name="region" maxLength={100} placeholder="例如：台北市" className={input} /></label><button className={`${button} self-end`} disabled={loading}>搜尋／重新整理</button></form>
    {error && <p role="alert" className="my-4 text-red-700">{error}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]"><section><p className="mb-3 text-sm text-ink/60">共 {total} 筆需求（每筆獨立處理）{loading && ' · 讀取中…'}</p><div className="space-y-3">{rows.map(row => <button key={row.id} onClick={() => setSelected(row.id)} className={`w-full rounded-2xl border p-4 text-left ${selected === row.id ? 'border-champagne-700 bg-champagne-100' : 'border-champagne-300 bg-white'}`}><p className="flex justify-between gap-2"><b>{row.name}</b><span className="text-sm text-champagne-700">{row.reply === 'yes' && row.stage === 'arrived' ? '待看貨' : stages[row.stage]}</span></p><p className="mt-2 text-sm">{row.phone} · {row.viewing_region}</p><p className="mt-2 font-serif">{row.selected_product_name}</p><p className="mt-2 text-xs text-ink/60">{time(row.created_at)}</p>{row.reply && <p className="mt-2 text-sm text-rose-400">客戶：{choices[row.reply]}</p>}</button>)}</div><div className="mt-4 flex justify-between"><button disabled={!query.page} onClick={() => setQuery({ ...query, page: query.page - 1 })}>上一頁</button><span>{query.page + 1}</span><button disabled={(query.page + 1) * 30 >= total} onClick={() => setQuery({ ...query, page: query.page + 1 })}>下一頁</button></div></section>
      {detail ? <Detail key={`${detail.request.id}:${detail.fulfillment.version}`} data={detail} refresh={refresh} /> : <p className="rounded-2xl bg-white p-8">{selected ? '讀取需求中…' : '選擇一筆需求開始處理。'}</p>}
    </div></>
}

function Detail({ data, refresh }: { data: AdminDetail; refresh: () => Promise<void> }) {
  const { request: r, fulfillment: f } = data
  const original = r.submission_fingerprint
  const [stage, setStage] = useState(f.stage)
  const [arrivalDate, setArrivalDate] = useState(today())
  const [endDate, setEndDate] = useState(deadline(today()))
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
    setBusy(true); setError(''); const fields = new FormData(event.currentTarget)
    try { await rpc(true, 'admin_process_request', { p_id: r.id, p_version: f.version, p_stage: stage, p_fields: Object.fromEntries(fields), p_note: fields.get('note') || '' }); await refresh() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="space-y-6 rounded-3xl bg-white p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-2xl">{r.selected_product_name}</h2><p className="mt-2 break-all text-xs text-ink/50">{r.id}</p></div><button onClick={() => void refresh()} className="text-sm text-champagne-700">重新整理</button></div>
    <section className="rounded-2xl bg-ivory p-4 text-sm leading-7"><h3 className="font-medium">客戶原始需求（唯讀）</h3><p>提交：{time(r.created_at)}</p><p>姓名：{original.name} / 手機：{original.phone}</p><p>LINE：{original.line_id || '未提供'} / 所在地：{original.region}</p><p>希望看貨地區：{r.viewing_region}</p><p>原始希望時間：{time(r.preferred_viewing_time)}</p><p>用途：{answerLabel(purposeOptions, r.purpose)} / 類別：{answerLabel(categoryOptions, r.category)}</p><p>材質：{r.material_preferences.map(v => answerLabel(materialOptions, v)).join('、') || '不限'}</p><p>預算：{answerLabel(budgetOptions, r.budget)} / 風格：{answerLabel(styleOptions, r.style)}</p><p>第 5 題：{r.reference_photo_url ? '已上傳參考照片' : '未上傳照片／直接找尋'}</p><p className="mt-2 text-ink/60">客戶目前聯絡資料：{data.customer.name}／{data.customer.phone}／{data.customer.line_id || '未提供 LINE'}／{data.customer.region}</p>{r.reference_photo_url && <button type="button" onClick={() => void showPhoto()} className="mt-3 text-champagne-700">載入／重新載入私人參考照片（5 分鐘有效）</button>}{photoError && <p role="alert">{photoError}</p>}{photo && <img src={photo} alt="客戶上傳的私人珠寶參考照片" className="mt-3 max-h-80 rounded-xl object-contain" />}</section>
    <section className="text-sm leading-7"><h3 className="font-medium">目前安排</h3><p>{stages[f.stage]} · 來源合作店家：{f.partner_store || '尚未確認'}</p>{f.arrived_on && <p>到店：{f.arrived_on}／期限：{f.viewing_deadline} 23:59<br />看貨店家：{f.viewing_store}<br />地址：{f.store_address}</p>}{f.failure_detail && <p className="mt-2 text-red-700">最近無法調貨原因（僅內部）：{failures[f.failure_code || '']}／{f.failure_detail}</p>}</section>
    <form onSubmit={process} className="space-y-4 border-t border-champagne-300 pt-5"><h3 className="font-serif text-xl">處理需求／內部備註</h3><label className="block text-sm">更新處理狀態<select value={stage} onChange={e => setStage(e.target.value)} className={input}><option value={f.stage}>保留目前狀態，新增備註</option>{transitions[f.stage].map(s => <option value={s} key={s}>{s === 'checking' && ['arrived', 'unavailable'].includes(f.stage) ? '重新確認／重新安排' : stages[s]}</option>)}</select></label>
      {['transferring', 'in_transit'].includes(stage) && stage !== f.stage && <label className="block text-sm">來源合作店家 *<input name="partner_store" defaultValue={f.partner_store} maxLength={200} required className={input} /></label>}
      {stage === 'unavailable' && stage !== f.stage && <><label className="block text-sm">內部無法調貨原因 *<select name="failure_code" required className={input}>{Object.entries(failures).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label className="block text-sm">完整真實原因（不向客戶公開）*<textarea name="failure_detail" required maxLength={2000} className={input} /></label><p className="text-xs text-ink/60">儲存後只發佈適合客戶的固定 App 通知，不會顯示內部原因。</p></>}
      {stage === 'arrived' && stage !== f.stage && <><label className="block text-sm">實際到店日期 *<input name="arrived_on" type="date" max={today()} value={arrivalDate} onChange={e => { setArrivalDate(e.target.value); if (e.target.value) setEndDate(deadline(e.target.value)) }} required className={input} /></label><label className="block text-sm">看貨店家 *<input name="viewing_store" required maxLength={200} className={input} /></label><label className="block text-sm">店家地址 *<input name="store_address" required maxLength={500} className={input} /></label><label className="block text-sm">最後看貨期限 *<input name="viewing_deadline" type="date" min={arrivalDate} max={arrivalDate ? deadline(arrivalDate) : undefined} value={endDate} onChange={e => setEndDate(e.target.value)} required className={input} /></label><p className="text-xs text-ink/60">到店日算第 1 天，第 7 天 23:59 截止（台灣時間）。儲存時同步發佈 App 到店通知。</p></>}
      <label className="block text-sm">內部備註{stage === f.stage || (stage === 'checking' && ['arrived', 'unavailable'].includes(f.stage)) ? ' *' : ''}<textarea name="note" maxLength={2000} required={stage === f.stage || (stage === 'checking' && ['arrived', 'unavailable'].includes(f.stage))} className={input} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className={button}>{busy ? '儲存中…' : '儲存處理結果'}</button>
    </form>
    <section className="border-t border-champagne-300 pt-5"><h3 className="font-serif text-xl">App 通知與客戶回覆</h3>{!data.notifications.length && <p className="mt-3 text-sm">尚無通知</p>}{data.notifications.map(n => { const reply = data.responses.find(v => v.notification_id === n.id); return <div className="mt-3 rounded-xl bg-ivory p-4 text-sm leading-7" key={n.id}><p>{n.message}</p><p className="text-xs text-ink/60">App 已發佈：{time(n.published_at)} · {n.read_at ? `已讀：${time(n.read_at)}` : '客戶尚未讀取'}</p>{reply && <p className="mt-2 text-champagne-700">客戶回覆：{choices[reply.choice]}<br />預計日期：{reply.proposed_date || '未填寫'}<br />說明：{reply.note || '無'}<br />回覆時間：{time(reply.updated_at)}{n.id !== f.arrival_notification_id && <><br />（先前安排的回覆）</>}</p>}</div> })}</section>
    <details><summary className="cursor-pointer text-champagne-700">內部處理紀錄（{data.activity.length}）</summary>{data.activity.map(a => <div key={a.id} className="mt-3 whitespace-pre-wrap border-t border-champagne-100 py-3 text-sm"><p>{time(a.created_at)} · {stages[a.from_stage]} → {stages[a.to_stage]}</p><p className="mt-2">{a.note || '狀態已更新'}</p></div>)}</details>
  </section>
}
