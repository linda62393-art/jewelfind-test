export interface Organization { title: string; pinned: boolean; hidden: boolean }
const key = 'jewelfind-request-organization-v1'
let memory: Record<string, Organization> = {}
export function organizations(): Record<string, Organization> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || '{}')
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      for (const [id, value] of Object.entries(stored)) {
        if (value && typeof value === 'object') {
          const row = value as Record<string, unknown>
          if (!memory[id]) memory[id] = { title: typeof row.title === 'string' ? row.title.slice(0, 100) : '', pinned: row.pinned === true, hidden: row.hidden === true }
        }
      }
    }
  } catch { /* The current page can still organize receipts in memory. */ }
  return { ...memory }
}
export function organizeRequest(id: string, update: Partial<Organization>): boolean {
  const stored = organizations()
  const previous = stored[id] || { title: '', pinned: false, hidden: false }
  memory = { ...stored, [id]: { ...previous, ...update } }
  memory[id].title = memory[id].title.trim().slice(0, 100)
  try { localStorage.setItem(key, JSON.stringify(memory)); return true } catch { return false }
}
export function organizedRequests<T extends { id: string; createdAt: string }>(receipts: T[], meta: Record<string, Organization>, hidden: boolean): T[] {
  return receipts.filter(r => Boolean(meta[r.id]?.hidden) === hidden).sort((a, b) => Number(Boolean(meta[b.id]?.pinned)) - Number(Boolean(meta[a.id]?.pinned)) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
}
export interface ProgressEvent { id: string; message: string; occurred_at: string; kind: string }
export function progressEvents(createdAt: string, events: ProgressEvent[]): ProgressEvent[] {
  return [...new Map([{ id: 'submitted', message: '已收到您的看貨需求。', occurred_at: createdAt, kind: 'submitted' }, ...events].map(e => [e.id, e])).values()].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at) || b.id.localeCompare(a.id))
}
