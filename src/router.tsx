import { ProductDetailPage } from './pages/ProductDetailPage'
import { ViewingPage, ViewingSuccessPage } from './pages/ViewingPage'
import { createBrowserRouter, createHashRouter } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { MatchPage } from './pages/MatchPage'
import { RecommendationsPage } from './pages/RecommendationsPage'
import { AdminPage } from './pages/AdminPage'
import { RequestPage, RequestsPage } from './pages/RequestsPage'

const createRouter = import.meta.env.MODE === 'pages' ? createHashRouter : createBrowserRouter
export const router = createRouter([
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

