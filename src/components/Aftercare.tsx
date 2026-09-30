import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { rpc, time, today } from '../services/phase6'
import { feedbackFields, feedbackOptions, followStatuses, outcomes, preferences, reasons, type AftercareData, type Feedback, type FeedbackFields, type FollowRow } from '../services/aftercare'

const input = 'mt-2 min-h-12 w-full rounded-xl border border-champagne-300 bg-white p-3'
const button = 'min-h-12 rounded-xl bg-champagne-700 px-5 py-3 text-white disabled:opacity-50'

function FeedbackSummary({ feedback }: { feedback: Feedback }) {
  return <div className="rounded-xl bg-ivory p-4 text-sm leading-7"><p>{outcomes[feedback.outcome]} · 看貨日期：{feedback.viewed_on}</p><p>原因：{feedback.reasons.map(r => reasons[r]).join('、') || '未填寫'}</p><p>可接受預算：{feedback.budget_min == null && feedback.budget_max == null ? '未提供' : `NT$ ${feedback.budget_min?.toLocaleString() ?? '不限下限'} ～ ${feedback.budget_max?.toLocaleString() ?? '不限上限'}`}</p><p>想找的商品：{feedback.wanted_product || '未補充'}</p><p>後續意願：{preferences[feedback.contact_preference]}</p><p className="whitespace-pre-wrap">說明：{feedback.note || '無'}</p><p className="mt-2 text-xs text-ink/60">{feedback.source === 'customer' ? '客戶自行填寫' : '管理員依客戶回覆代填'} · {time(feedback.created_at)}</p></div>
}

function FeedbackForm({ initial, admin, save }: { initial: Feedback | null; admin: boolean; save: (fields: FeedbackFields) => Promise<void> }) {
  const initialChoice = initial ? feedbackOptions.find(o => o.outcome === initial.outcome && (initial.outcome !== 'not_purchased' || initial.reasons.includes(o.value)))?.value || 'service' : ''
  const [selected, setSelected] = useState(initialChoice)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try { await save(feedbackFields(new FormData(event.currentTarget))) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <form onSubmit={submit} className="mt-4 space-y-4"><h4 className="font-medium">{admin ? '代填客戶回饋' : '這次看貨感覺如何？'}</h4><fieldset className="grid gap-2 sm:grid-cols-2"><legend className="sr-only">看貨結果</legend>{feedbackOptions.map(o => <label key={o.value} className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 text-sm ${selected === o.value ? 'border-champagne-700 bg-champagne-100' : 'border-champagne-300'}`}><input type="radio" name="feedback_choice" value={o.value} checked={selected === o.value} onChange={() => setSelected(o.value)} required />{o.label}</label>)}</fieldset><label className="block text-sm">願意花多少？（NT$，選填）<input name="budget_max" type="number" min="0" max="100000000" step="1" defaultValue={initial?.budget_max ?? ''} placeholder="例如 30000" className={input} /></label><label className="block text-sm">還想找什麼？（選填）<input name="wanted_product" maxLength={200} defaultValue={initial?.wanted_product || ''} placeholder="例如：簡約鑽戒、珍珠耳環" className={input} /></label><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="allow_recommend" defaultChecked={initial?.contact_preference === 'recommend'} />願意收到適合的商品推薦</label><details><summary className="min-h-11 cursor-pointer text-sm text-champagne-700">日期與補充說明（選填）</summary><label className="block text-sm">看貨日期<input name="viewed_on" type="date" required max={today()} defaultValue={initial?.viewed_on || today()} className={input} /></label><label className="mt-3 block text-sm">補充說明<textarea name="feedback_note" maxLength={2000} defaultValue={initial?.note || ''} className={input} /></label></details><p className="text-xs text-ink/60">{admin ? '代填內容會顯示給客戶，內部筆記請填下方追蹤紀錄。' : '協助我們找到更適合你的珠寶；你可以稍後更新。'}</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy} className={button}>{busy ? '儲存中…' : admin ? '儲存代填回饋' : '送出回饋'}</button></form>
}

export function Aftercare({ requestId, token, admin = false, onChange, revision = 0 }: { requestId: string; token?: string; admin?: boolean; onChange?: () => void; revision?: number }) {
  const [data, setData] = useState<AftercareData | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setData(await rpc<AftercareData>(admin, admin ? 'admin_aftercare' : 'customer_aftercare', { p_id: requestId, ...(!admin && { p_token: token }) })); setError('') } catch (e) { setError((e as Error).message) } }, [admin, requestId, token])
  useEffect(() => { void load() }, [load, revision])
  async function save(fields: FeedbackFields) {
    await rpc(admin, admin ? 'admin_save_feedback' : 'customer_save_feedback', { p_id: requestId, p_expected: data?.feedback?.id || null, p_fields: fields, ...(!admin && { p_token: token }) })
    setNotice('看貨回饋已儲存。'); await load(); onChange?.()
  }
  async function invite() {
    setBusy(true); setError(''); setNotice('')
    try { await rpc(true, 'admin_invite_feedback', { p_id: requestId }); setNotice('已發佈 App 回饋邀請，客戶開啟需求頁即可填寫。'); await load(); onChange?.() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form); setBusy(true); setError(''); setNotice('')
    try { await rpc(true, 'admin_save_followup', { p_id: requestId, p_version: data?.followup?.version ?? -1, p_status: fields.get('status'), p_next: fields.get('next_contact_on') || null, p_note: fields.get('follow_note') }); form.reset(); setNotice('追蹤紀錄已儲存。'); await load(); onChange?.() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="my-6 space-y-4 rounded-2xl border border-champagne-300 bg-white p-5"><h3 className="font-serif text-xl">看貨後回饋{admin && '與追蹤'}</h3><button onClick={() => void load()} className="min-h-11 text-sm text-champagne-700">重新整理回饋</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-champagne-100 p-3 text-sm">{notice}</p>}{data && <>{data.feedback ? <FeedbackSummary feedback={data.feedback} /> : <p className="text-sm">尚未收到看貨後回饋。</p>}{data.eligible ? <><p className="text-sm leading-7 text-ink/60">看完商品後，選一個最接近的答案即可。</p>{admin && <button disabled={busy} onClick={() => void invite()} className={button}>邀請客戶填寫回饋</button>}<FeedbackForm key={data.feedback?.id || 'new'} initial={data.feedback} admin={admin} save={save} /></> : <p className="text-sm text-ink/60">商品到店通知發佈後，這裡會開放看貨後回饋。</p>}{admin && <><form key={data.followup?.version ?? -1} onSubmit={track} className="space-y-4 border-t border-champagne-300 pt-5"><h4 className="font-medium">管理員追蹤紀錄（僅內部）</h4>{data.feedback?.contact_preference === 'none' && <p className="text-sm text-rose-500">客戶選擇暫不聯絡，請尊重其意願。</p>}<label className="block text-sm">追蹤狀態<select name="status" defaultValue={data.followup?.status || 'pending'} className={input}>{Object.entries(followStatuses).map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label><label className="block text-sm">下次聯絡日期（選填；結案時清除）<input name="next_contact_on" type="date" min={today()} defaultValue={data.followup?.next_contact_on || ''} className={input} /></label><label className="block text-sm">本次聯繫內容／處理說明 *<textarea name="follow_note" maxLength={2000} required className={input} /></label><button disabled={busy} className={button}>儲存追蹤紀錄</button></form><details><summary className="min-h-11 cursor-pointer text-champagne-700">歷次回饋（{data.history?.length || 0}）</summary><div className="space-y-3">{data.history?.map(f => <FeedbackSummary key={f.id} feedback={f} />)}</div></details><details><summary className="min-h-11 cursor-pointer text-champagne-700">內部聯繫紀錄（{data.events?.length || 0}）</summary>{data.events?.map(e => <div key={e.id} className="border-t border-champagne-100 py-3 text-sm leading-7"><p>{time(e.created_at)} · {followStatuses[e.status]} · 下次聯絡：{e.next_contact_on || '未設定'}</p><p className="whitespace-pre-wrap">{e.note}</p></div>)}</details></>}</>}</section>
}

export function FollowupQueue({ select, revision }: { select: (id: string) => void; revision: number }) {
  const [filter, setFilter] = useState('due')
  const [page, setPage] = useState(0)
  const [items, setItems] = useState<FollowRow[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const load = useCallback(async () => { try { const d = await rpc<{ items: FollowRow[]; total: number }>(true, 'admin_followup_queue', { p_filter: filter, p_page: page }); setItems(d.items); setTotal(d.total); setError('') } catch (e) { setError((e as Error).message) } }, [filter, page])
  useEffect(() => { void load() }, [load, revision])
  return <section className="mb-6 rounded-2xl bg-white p-5"><div className="flex flex-wrap items-center gap-4"><h2 className="font-serif text-xl">看貨後追蹤待辦</h2><label className="text-sm">篩選<select className={input} value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }}><option value="due">今天到期／已逾期</option><option value="open">全部未結案</option>{Object.entries(followStatuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><button onClick={() => void load()} className="min-h-11 text-sm text-champagne-700">重新整理待辦</button></div>{error && <p role="alert">{error}</p>}<p className="mt-3 text-sm text-ink/60">共 {total} 筆；日期以台灣時間計算。</p>{!items.length && !error && <p className="mt-3 text-sm">目前沒有符合條件的追蹤紀錄。</p>}<div className="mt-3 grid gap-3 md:grid-cols-2">{items.map(r => <button className="rounded-xl border border-champagne-300 p-4 text-left text-sm leading-7" key={r.id} onClick={() => select(r.id)}><b>{r.name}</b> · {r.product}<br />{followStatuses[r.status]} · 下次聯絡：{r.next_contact_on || '未設定'}<br />回饋：{r.outcome ? outcomes[r.outcome] : '尚未填寫'}{r.contact_preference && <> · {preferences[r.contact_preference]}</>}</button>)}</div><div className="mt-4 flex justify-between text-sm"><button disabled={!page} onClick={() => setPage(page - 1)}>上一頁</button><span>{page + 1}</span><button disabled={(page + 1) * 30 >= total} onClick={() => setPage(page + 1)}>下一頁</button></div></section>
}
