import { useRef, useState } from 'react'
import { rpc, type CustomerRequest } from '../services/phase6'
import { isCompletedRequest } from '../services/requestSummary'
import { cancelBeforeTrash } from '../services/requestTrash'
import type { ViewingReceipt } from '../services/viewingService'

export function RequestTrashAction({ receipt, data, trashed, onTrashed, refresh }: { receipt: ViewingReceipt; data: CustomerRequest | null; trashed: boolean; onTrashed: () => void; refresh: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const flight = useRef(false)
  const active = Boolean(data && !isCompletedRequest(data.stage))
  if (trashed && !active) return null
  async function move() {
    if (!data || flight.current) return
    flight.current = true; setBusy(true); setError('')
    try {
      await cancelBeforeTrash({
        load: () => rpc<CustomerRequest>(false, 'customer_request_v8', { p_id: receipt.id, p_token: receipt.accessToken }),
        cancel: (version, actionId) => rpc<void>(false, 'customer_change_viewing', { p_id: receipt.id, p_token: receipt.accessToken, p_version: version, p_action_id: actionId, p_action: 'cancel', p_time: null }),
      })
      onTrashed(); setConfirm(false)
      await refresh()
    } catch (e) { setError((e as Error).message); await refresh() }
    finally { flight.current = false; setBusy(false) }
  }
  return <div className="mt-3 text-sm">
    {!confirm && <button type="button" disabled={busy || !data} onClick={() => active ? setConfirm(true) : void move()} className="min-h-11 rounded-xl border border-red-200 px-4 text-red-700 disabled:opacity-50">{trashed ? '取消看貨並釋出名額' : active ? '取消並移到垃圾桶' : '移到垃圾桶'}</button>}
    {confirm && <div className="rounded-xl bg-rose-50 p-3"><p className="leading-6">確定不再需要這筆看貨？確認後會取消安排、釋出名額並保留紀錄。如商品已調出，平台會協調後續處理。</p><div className="mt-2 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void move()} className="min-h-11 rounded-xl bg-red-700 px-4 text-white disabled:opacity-50">{busy ? '取消中…' : '確認取消並移到垃圾桶'}</button><button type="button" disabled={busy} onClick={() => setConfirm(false)} className="min-h-11 px-3">保留需求</button></div></div>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </div>
}
