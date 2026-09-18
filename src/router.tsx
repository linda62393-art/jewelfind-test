import { ProductDetailPage } from './pages/ProductDetailPage'
import { ViewingPage, ViewingSuccessPage } from './pages/ViewingPage'
import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { MatchPage } from './pages/MatchPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { AdminPage } from './pages/AdminPage'
import { RequestPage, RequestsPage } from './pages/RequestsPage'

export const router = createBrowserRouter([
  { path: '/admin', element: <AdminPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'match', element: <MatchPage /> },
      { path: 'recommendations', element: <RecommendationsPage /> },
      { path: 'products/:productId', element: <ProductDetailPage /> },
      { path: 'products/:productId/viewing', element: <ViewingPage /> },
      { path: 'viewing/success/:requestId', element: <ViewingSuccessPage /> },
      { path: 'my-requests', element: <RequestsPage /> },
      { path: 'my-requests/:requestId', element: <RequestPage /> },
    ],
  },
])

