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
  await initializeSupabase()
  await initializeMobileOnboarding()
  createRoot(document.getElementById('root')!).render(
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
