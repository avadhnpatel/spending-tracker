import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { TrackerProvider } from './context/TrackerContext'
import { applyTheme, getThemePreference } from './lib/theme'
import { initializeSupabase } from './lib/supabase'
import { initializeMobileOnboarding } from './lib/mobile-onboarding'
import './index.css'

applyTheme(getThemePreference())

async function start() {
  const root = createRoot(document.getElementById('root')!)
  try {
    await initializeSupabase()
    await initializeMobileOnboarding()
  } catch (error) {
    root.render(<div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 text-stone-900">
      <h1 className="text-2xl font-semibold">Could not open Spend</h1>
      <p className="mt-3 text-stone-600">{error instanceof Error ? error.message : 'Your account could not be verified right now.'}</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-12 rounded-xl bg-teal-800 px-5 font-semibold text-white">Try again</button>
    </div>)
    return
  }
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <TrackerProvider>
            <App />
          </TrackerProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

void start()
