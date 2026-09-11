import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { MatchAnswers } from '../types/matching'

interface MatchAnswersContextValue {
  answers: MatchAnswers
  updateAnswers: (values: Partial<MatchAnswers>) => void
  resetAnswers: () => void
}

const storageKey = 'jewel-match-answers'
const MatchAnswersContext = createContext<MatchAnswersContextValue | null>(null)

function readStoredAnswers(): MatchAnswers {
  try {
    const stored = sessionStorage.getItem(storageKey)
    return stored ? (JSON.parse(stored) as MatchAnswers) : { materials: [] }
  } catch {
    return { materials: [] }
  }
}

export function MatchAnswersProvider({ children }: PropsWithChildren) {
  const [answers, setAnswers] = useState<MatchAnswers>(readStoredAnswers)

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(answers, (key, value) => (
      key === 'uploadedImage' || key === 'uploadedImagePreview' ? undefined : value
    )))
  }, [answers])

  const value = useMemo(() => ({
    answers,
    updateAnswers: (values: Partial<MatchAnswers>) => setAnswers((current) => ({ ...current, ...values })),
    resetAnswers: () => setAnswers({ materials: [] }),
  }), [answers])

  return <MatchAnswersContext.Provider value={value}>{children}</MatchAnswersContext.Provider>
}

export function useMatchAnswers() {
  const context = useContext(MatchAnswersContext)
  if (!context) throw new Error('useMatchAnswers must be used inside MatchAnswersProvider')
  return context
}
