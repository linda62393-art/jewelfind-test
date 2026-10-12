import type { CustomerRequest } from './phase6'

const completed: Record<string, string> = { cancelled: '已取消', viewed: '已看貨', purchased: '已看貨・已購買', not_purchased: '已看貨・未購買', no_show: '未赴店', sold: '商品已售出', unavailable: '無法安排看貨' }

export function isCompletedRequest(stage?: string) { return Boolean(stage && completed[stage]) }

export function requestSummary(data: CustomerRequest | null, createdAt: string) {
  if (!data) return { label: '讀取進度中', occurredAt: createdAt, dateLabel: '需求時間' }
  const stage = data.stage
  const matching = data.notifications.filter(n => n.kind === stage || n.details.stage === stage || (stage === 'cancelled' && n.details.action === 'cancel')).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0]
  const label = completed[stage] || (data.appointment?.pending ? '改約待店家確認' : '')
  // Later follow-up messages must not replace the actual viewing/cancellation time.
  return { label, occurredAt: matching?.published_at || (completed[stage] ? null : data.timeline?.[0]?.occurred_at || createdAt), dateLabel: matching ? '狀態更新' : completed[stage] ? '狀態時間未記錄' : '需求進度' }
}
