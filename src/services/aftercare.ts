export const outcomes: Record<string, string> = { purchased: '已購買', not_purchased: '未購買', considering: '尚待考慮', more_options: '還想看其他款' }
export const reasons: Record<string, string> = { style: '不喜歡款式／配戴效果', over_budget: '超出預算', service: '店家服務問題', unclear: '店家答覆不明確', other: '其他' }
export const preferences: Record<string, string> = { recommend: '希望推薦其他款', revisit: '希望安排再次看貨', later: '希望稍後聯絡', none: '暫不聯絡' }
export const followStatuses: Record<string, string> = { awaiting_feedback: '待客戶回饋', pending: '待追蹤', contacted: '已聯繫', closed: '已結案' }
export interface FeedbackFields { viewed_on: string; outcome: string; reasons: string[]; budget_min: number | null; budget_max: number | null; contact_preference: string; note: string; wanted_product: string }
export interface Feedback extends FeedbackFields { id: string; source: 'customer' | 'admin'; created_at: string }
export interface FollowUp { status: string; next_contact_on: string | null; version: number }
export interface FollowEvent { id: string; status: string; next_contact_on: string | null; note: string; created_at: string }
export interface AftercareData { eligible: boolean; feedback: Feedback | null; history?: Feedback[]; followup?: FollowUp | null; events?: FollowEvent[] }
export interface FollowRow { id: string; name: string; product: string; status: string; next_contact_on: string | null; outcome: string | null; contact_preference: string | null }

export function feedbackFields(form: FormData): FeedbackFields {
  const selected = feedbackOptions.find(o => o.value === String(form.get('feedback_choice') || ''))
  const outcome = selected?.outcome || String(form.get('outcome') || '')
  return { viewed_on: String(form.get('viewed_on') || ''), outcome, reasons: outcome === 'purchased' ? [] : selected ? selected.reasons : form.getAll('reasons').map(String), budget_min: form.get('budget_min') ? Number(form.get('budget_min')) : null, budget_max: form.get('budget_max') ? Number(form.get('budget_max')) : null, contact_preference: String(form.get('contact_preference') || (form.get('allow_recommend') === 'on' ? 'recommend' : 'none')), note: String(form.get('feedback_note') || '').trim(), wanted_product: String(form.get('wanted_product') || '').trim() }
}

export const requestColors: Record<string, string> = { new: 'bg-slate-50', checking: 'bg-blue-50', transferring: 'bg-amber-50', in_transit: 'bg-amber-50', arrived: 'bg-emerald-50', unavailable: 'bg-red-50', notified: 'bg-blue-50', cancelled: 'bg-slate-100', sold: 'bg-rose-50', viewed: 'bg-teal-50', purchased: 'bg-green-100', not_purchased: 'bg-orange-50', no_show: 'bg-rose-50' }

export const feedbackOptions = [
  { value: 'purchased', label: '已購買', outcome: 'purchased', reasons: [] },
  { value: 'style', label: '款式不合', outcome: 'not_purchased', reasons: ['style'] },
  { value: 'over_budget', label: '價格太高', outcome: 'not_purchased', reasons: ['over_budget'] },
  { value: 'service', label: '服務／答覆不清楚', outcome: 'not_purchased', reasons: ['service'] },
  { value: 'considering', label: '考慮中', outcome: 'considering', reasons: [] },
  { value: 'more_options', label: '想看其他款', outcome: 'more_options', reasons: [] },
]
