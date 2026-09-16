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
const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })))
const AccountCallbackPage = lazy(() => import('./pages/AccountCallbackPage').then((module) => ({ default: module.AccountCallbackPage })))
const MorePage = lazy(() =>
  import('./pages/MorePage').then((module) => ({ default: module.MorePage })),
)
const RecurringPage = lazy(() =>
  import('./pages/RecurringPage').then((module) => ({ default: module.RecurringPage })),
)
const SetupPage = lazy(() =>
  import('./pages/SetupPage').then((module) => ({ default: module.SetupPage })),
)
const PrivacyPage = lazy(() =>
  import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })),
)
const TermsPage = lazy(() =>
  import('./pages/PrivacyPage').then((module) => ({ default: module.TermsPage })),
)
const TrackersPage = lazy(() =>
  import('./pages/TrackersPage').then((module) => ({ default: module.TrackersPage })),
)

function ProtectedApp() {
  const { configured, loading, user } = useAuth()

  if (!configured) return <Navigate to="/account" replace />

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
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/callback" element={<AccountCallbackPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route element={<ProtectedApp />}>
          <Route index element={<HomePage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="add" element={<AddTransactionPage />} />
          <Route path="add/:id" element={<AddTransactionPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/trackers" element={<TrackersPage />} />
          <Route path="more/categories" element={<CategoriesPage />} />
          <Route path="more/recurring" element={<RecurringPage />} />
          <Route path="more/import" element={<Navigate to="/import" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
