import { createClient } from '@supabase/supabase-js'
import type { ViewingReceipt } from './viewingService'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://unconfigured.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'unconfigured'
export const adminClient = createClient(url, key, { auth: { storageKey: 'jewelfind-admin', persistSession: true } })
export const customerClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
export const stages: Record<string, string> = { new: '新需求', checking: '確認商品／合作店家', transferring: '調貨處理', in_transit: '調貨成功／運送中', unavailable: '暫時無法安排', arrived: '商品到店' }
export const choices: Record<string, string> = { yes: '可以，我會在一週內前往', reschedule: '時間無法配合', declined: '暫時不想看了' }
export const failures: Record<string, string> = { precious: '商品貴重，原店家無法借出', store_unavailable: '店家不願／無法配合調貨', sold: '商品已售出', not_transferable: '商品目前無法調出', no_partner: '指定地區無適合合作店家', other: '其他' }
export const transitions: Record<string, string[]> = { new: ['checking'], checking: ['transferring', 'unavailable'], transferring: ['in_transit', 'unavailable'], in_transit: ['arrived', 'unavailable'], unavailable: ['checking'], arrived: ['checking'] }
export const time = (value?: string | null) => value ? new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—'
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const deadline = (date: string) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10) }
export interface Notice { id: string; kind: string; message: string; published_at: string; read_at: string | null; details: { store?: string; address?: string; arrivedOn?: string; deadline?: string } }
export interface Reply { notification_id: string; choice: string; proposed_date: string | null; note: string; updated_at: string }
export interface CustomerRequest { id: string; productId: string; productName: string; preferredTime: string; createdAt: string; stage: string; arrivalNotificationId: string | null; notifications: Notice[]; responses: Reply[] }
export interface RequestRow { id: string; created_at: string; selected_product_name: string; viewing_region: string; name: string; phone: string; line_id: string | null; region: string; stage: string; reply: string | null }
export interface AdminDetail {
  request: { id: string; created_at: string; selected_product_id: string; selected_product_name: string; purpose: string; category: string; material_preferences: string[]; budget: string; style: string; reference_photo_url: string | null; preferred_viewing_time: string; viewing_region: string; submission_fingerprint: { name: string; phone: string; line_id: string; region: string } }
  customer: { id: string; name: string; phone: string; line_id: string | null; region: string }
  fulfillment: { stage: string; version: number; partner_store: string; viewing_store: string; store_address: string; arrived_on: string | null; viewing_deadline: string | null; failure_code: string | null; failure_detail: string | null; arrival_notification_id: string | null }
  notifications: Notice[]; responses: Reply[]; activity: { id: string; from_stage: string; to_stage: string; note: string; created_at: string }[]
}
export async function rpc<T>(admin: boolean, name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (admin ? adminClient : customerClient).rpc(name, params)
  if (error) {
    const messages: Record<string, string> = { admin_required: '此帳號尚未獲得管理員授權。', access_denied: '無法驗證這筆需求的存取連結。', version_conflict: '其他管理員已更新此需求，請重新整理後再操作。', stale_arrival: '看貨安排已更新，請重新整理。', deadline_passed: '看貨期限已過，請選擇時間無法配合以便重新安排。', invalid_transition: '無法進行此狀態變更，請重新整理。', note_required: '請填寫內部備註。', rearrange_note_required: '請說明重新安排原因。', failure_reason_required: '請選擇並填寫完整內部原因。', partner_required: '請填寫合作店家。', arrival_fields_required: '請確認到店資料及七天內的期限。' }
    throw new Error(messages[error.message] || '暫時無法完成操作，請檢查連線或登入狀態後重試。')
  }
  return data as T
}
const vaultKey = 'jewelfind-request-access-v1'
const memory = new Map<string, ViewingReceipt>()
export function savedRequests(): ViewingReceipt[] {
  let stored: ViewingReceipt[] = []
  try { const data = JSON.parse(localStorage.getItem(vaultKey) || '[]'); if (Array.isArray(data)) stored = data.filter(r => typeof r.id === 'string' && /^[a-f0-9]{64}$/.test(r.accessToken)) } catch { /* Memory and saved links still work when browser storage is unavailable. */ }
  return [...new Map([...stored, ...memory.values()].map(r => [r.id, r])).values()]
}
export function saveRequest(receipt: ViewingReceipt): boolean {
  memory.set(receipt.id, receipt)
  try { localStorage.setItem(vaultKey, JSON.stringify(savedRequests())); return true } catch { return false }
}
export function requestLink(receipt: ViewingReceipt) { return `/my-requests/${receipt.id}#key=${receipt.accessToken}` }
