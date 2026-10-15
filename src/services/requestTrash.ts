import type { CustomerRequest } from './phase6'
import { isCompletedRequest } from './requestSummary'

export interface TrashRequestApi {
  load: () => Promise<CustomerRequest>
  cancel: (version: number, actionId: string) => Promise<void>
}

// Hiding is allowed only after the server confirms the request no longer uses a slot.
// Reloading first also makes retry safe when a cancellation response was lost.
export async function cancelBeforeTrash(api: TrashRequestApi): Promise<CustomerRequest> {
  const current = await api.load()
  if (isCompletedRequest(current.stage)) return current
  if (!current.appointment?.canChange) throw new Error('無法確認取消權限，請重新整理需求後再試。')
  await api.cancel(current.appointment.version, crypto.randomUUID())
  const updated = await api.load()
  if (!isCompletedRequest(updated.stage)) throw new Error('尚未確認取消成功，需求已保留，請重新整理後再試。')
  return updated
}
