import { Outlet } from 'react-router'
import { MatchAnswersProvider } from '../../hooks/useMatchAnswers'

export function AppShell() {
  return (
    <main className="min-h-dvh bg-ivory text-ink">
      <div className="mx-auto min-h-dvh w-full max-w-md overflow-hidden bg-ivory shadow-[0_0_70px_rgba(89,65,38,0.08)]">
        <MatchAnswersProvider><Outlet /></MatchAnswersProvider>
      </div>
    </main>
  )
}
