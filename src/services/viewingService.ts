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
  customerId: string
  productId: string
  preferredTime: string
  createdAt: string
  status: 'submitted'
}

// Replace this adapter with Customer creation + Match Request creation later.
// The mock performs no network requests and keeps contact details in memory only.
export interface ViewingService {
  submit(input: MatchRequestInput): Promise<ViewingReceipt>
}
export const viewingService: ViewingService = {
  async submit(input) {
    if (!input.customer.name.trim() || !/^09\d{8}$/.test(input.customer.phone) || !input.customer.region.trim()) throw new Error('請確認姓名、手機與所在地區。')
    if (!Number.isFinite(Date.parse(input.preferredTime)) || Date.parse(input.preferredTime) <= Date.now()) throw new Error('請選擇未來的看貨時間。')
    return { id: crypto.randomUUID(), customerId: crypto.randomUUID(), productId: input.productId, preferredTime: input.preferredTime, createdAt: new Date().toISOString(), status: 'submitted' }
  },
}
