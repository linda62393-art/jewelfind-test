import { createContext, useContext, useState, type PropsWithChildren } from 'react'
import type { MatchRequestInput, ViewingReceipt } from '../services/viewingService'

interface ViewingState {
  saved: string[]
  toggleSave: (id: string) => void
  drafts: Record<string, MatchRequestInput>
  setDraft: (draft: MatchRequestInput) => void
  receipts: ViewingReceipt[]
  complete: (receipt: ViewingReceipt) => void
}
const Context = createContext<ViewingState | null>(null)
export function ViewingProvider({ children }: PropsWithChildren) {
  const [saved, setSaved] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<string, MatchRequestInput>>({})
  const [receipts, setReceipts] = useState<ViewingReceipt[]>([])
  return <Context.Provider value={{ saved, toggleSave: (id) => setSaved(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]), drafts, setDraft: draft => setDrafts(items => ({ ...items, [draft.productId]: draft })), receipts, complete: receipt => {
    setReceipts(items => [...items, receipt])
    setDrafts(items => { const next = { ...items }; delete next[receipt.productId]; return next })
  } }}>{children}</Context.Provider>
}
export function useViewing() {
  const value = useContext(Context)
  if (!value) throw new Error('ViewingProvider is required')
  return value
}
