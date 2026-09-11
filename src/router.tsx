import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { MatchPage } from './pages/MatchPage'
import { RecommendationsPage } from './pages/RecommendationsPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'match', element: <MatchPage /> },
      { path: 'recommendations', element: <RecommendationsPage /> },
    ],
  },
])
