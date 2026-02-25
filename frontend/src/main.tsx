import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { AdminPage } from './pages/AdminPage'
import { ContinuingPage } from './pages/ContinuingPage'
import { DashboardPage } from './pages/DashboardPage'
import { EnrollmentPage } from './pages/EnrollmentPage'
import { ProspectusPage } from './pages/ProspectusPage'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'prospectus', element: <ProspectusPage /> },
      { path: 'enrollment', element: <EnrollmentPage /> },
      { path: 'continuing', element: <ContinuingPage /> },
    ],
  },
])

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
