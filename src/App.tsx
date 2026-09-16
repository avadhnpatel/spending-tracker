import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './context/AuthContext'

const ActivityPage = lazy(() =>
  import('./pages/ActivityPage').then((module) => ({ default: module.ActivityPage })),
)
const AddTransactionPage = lazy(() =>
  import('./pages/AddTransactionPage').then((module) => ({ default: module.AddTransactionPage })),
)
const AuthCallbackPage = lazy(() =>
  import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })),
)
const CategoriesPage = lazy(() =>
  import('./pages/CategoriesPage').then((module) => ({ default: module.CategoriesPage })),
)
const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({ default: module.HomePage })),
)
const InsightsPage = lazy(() =>
  import('./pages/InsightsPage').then((module) => ({ default: module.InsightsPage })),
)
const ImportPage = lazy(() =>
  import('./pages/ImportPage').then((module) => ({ default: module.ImportPage })),
)
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const MorePage = lazy(() =>
  import('./pages/MorePage').then((module) => ({ default: module.MorePage })),
)
const RecurringPage = lazy(() =>
  import('./pages/RecurringPage').then((module) => ({ default: module.RecurringPage })),
)
const TrackersPage = lazy(() =>
  import('./pages/TrackersPage').then((module) => ({ default: module.TrackersPage })),
)

function ProtectedApp() {
  const { loading, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-stone-500">
        Loading Spend…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-stone-500">
          Loading…
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<ProtectedApp />}>
          <Route index element={<HomePage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="add" element={<AddTransactionPage />} />
          <Route path="add/:id" element={<AddTransactionPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/trackers" element={<TrackersPage />} />
          <Route path="more/categories" element={<CategoriesPage />} />
          <Route path="more/recurring" element={<RecurringPage />} />
          <Route path="more/import" element={<ImportPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
