export interface CustomerInput {
  name: string
  phone: string
  line: string
  region: string
}

export interface MatchRequestInput {
  productId: string
  preferredTime: string
  customer: CustomerInput
}

export interface ViewingReceipt {
  id: string
  productId: string
  preferredTime: string
  createdAt: string
  status: 'submitted'
  isNewCustomer: boolean
}

export interface ViewingService {
  submit(input: MatchRequestInput, answers: MatchAnswers): Promise<ViewingReceipt>
}
// Memory only: retain the same key on uncertain retries; clear after confirmed success.
let pending: { signature: string; photo?: File; key: string } | undefined
export const viewingService: ViewingService = {
  async submit(input, answers) {
    const backend = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!backend || !anonKey) throw new Error('看貨服務尚未完成連線設定，資料尚未送出。')
    if (!input.customer.name.trim() || !input.customer.region.trim()) throw new Error('請確認姓名與所在地區。')
    if (!Number.isFinite(Date.parse(input.preferredTime)) || Date.parse(input.preferredTime) <= Date.now()) throw new Error('請選擇未來的看貨時間。')
    if (!answers.purpose || !answers.category || !answers.budget || !answers.style) throw new Error('請先返回問答頁完成前面的偏好選擇。')
    const payload = { ...input, preferredTime: new Date(input.preferredTime).toISOString(), answers: { purpose: answers.purpose, category: answers.category, materials: answers.materials, budget: answers.budget, style: answers.style } }
    const signature = JSON.stringify(payload)
    if (!pending || pending.signature !== signature || pending.photo !== answers.uploadedImage) pending = { signature, photo: answers.uploadedImage, key: crypto.randomUUID() }
    const attempt = pending
    const body = new FormData()
    body.set('payload', JSON.stringify({ ...payload, submissionKey: attempt.key }))
    if (answers.uploadedImage) body.set('photo', answers.uploadedImage)
    let response: Response
    try { response = await fetch(`${backend}/functions/v1/submit-viewing`, { method: 'POST', headers: { Authorization: 'Bearer ' + anonKey, apikey: anonKey }, body, signal: AbortSignal.timeout(45000) }) }
    catch { throw new Error('連線中斷或逾時，請保留表單並重試；同一筆需求不會重複建立。') }
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? '暫時無法送出，請稍後重試。')
    if (!data || typeof data.id !== 'string' || typeof data.isNewCustomer !== 'boolean' || data.status !== 'submitted' || data.productId !== input.productId || typeof data.preferredTime !== 'string' || typeof data.createdAt !== 'string') throw new Error('無法確認需求結果，請保留表單並重試。')
    if (pending === attempt) pending = undefined
    return data as ViewingReceipt
  },
}
import type { MatchAnswers } from '../types/matching'

