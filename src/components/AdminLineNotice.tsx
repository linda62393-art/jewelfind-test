import { useState } from 'react'
import { rpc, stages, time, type AdminDetail } from '../services/phase6'
import { requestUrl } from '../services/deployment'
import { lineManagerUrl, progressLineMessage } from '../services/lineContact'

interface Prepared { token: string; expiresAt: string }

export function AdminLineNotice({ data }: { data: AdminDetail }) {
  const [verified, setVerified] = useState(false)
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const latest = [...data.notifications].sort((a, b) => b.published_at.localeCompare(a.published_at))[0]
  const publicMessage = latest?.message || `目前進度：${stages[data.fulfillment.stage] || '確認安排中'}。詳細安排請查看需求頁或回覆此對話。`
  const text = prepared ? progressLineMessage(data.request.id, data.request.selected_product_name, publicMessage, requestUrl(window.location.origin, data.request.id, prepared.token)) : ''
  async function prepare() {
    if (!verified || busy) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await rpc<Prepared>(true, 'admin_prepare_request_line_notice', { p_id: data.request.id, p_version: data.fulfillment.version }); setPrepared(result); setNotice('通知內容已備妥，尚未送出。請複製並貼到這位客人的官方 LINE 對話。') }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="rounded-2xl border border-champagne-300 p-4"><h3 className="font-serif text-xl">LINE 通知／補發查詢連結</h3><p className="mt-3 text-sm leading-7 text-ink/65">網站內通知不會自動發 LINE。請先核對客人身分，產生通知後貼到正確對話；複製或開啟 LINE 都不代表已送出。只會帶入已公開的通知，不包含來源店家或內部備註。</p><label className="my-3 flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1" checked={verified} onChange={e => { setVerified(e.target.checked); if (!e.target.checked) { setPrepared(null); setNotice('') } }} />已核對需求編號與原留聯絡資料，確認此 LINE 對話是該客人。</label><button type="button" disabled={!verified || busy} onClick={() => void prepare()} className="min-h-12 rounded-xl bg-champagne-700 px-4 text-sm text-white disabled:opacity-50">{busy ? '準備中…' : prepared ? '重新產生通知連結' : '產生 LINE 通知與查詢連結'}</button>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-champagne-700">{notice}</p>}{prepared && verified && <><textarea aria-label="待傳送的 LINE 通知" readOnly rows={9} value={text} className="mt-4 w-full rounded-xl border border-champagne-300 bg-ivory p-3 text-sm" /><div className="mt-3 flex flex-wrap gap-4"><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setNotice('已複製，尚未傳送。請在官方 LINE 選擇這位客人並貼上傳送。') } catch { setNotice('無法自動複製，請選取上方內容複製。') } }} className="min-h-12 rounded-xl border border-champagne-700 px-4 text-sm text-champagne-700">複製 LINE 通知</button><a href={lineManagerUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center rounded-xl bg-[#06C755] px-4 text-sm font-medium text-white">開啟官方 LINE 對話管理 ↗</a></div><p className="mt-3 text-xs leading-6 text-ink/60">補發連結有效至 {time(prepared.expiresAt)}。再次產生會替換先前補發的連結；客人原送出時的專屬連結不受影響。請勿轉傳給其他人。</p></>}</section>
}
