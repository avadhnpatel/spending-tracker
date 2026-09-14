export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'spend.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function getThemePreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

export function applyTheme(preference: ThemePreference): void {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function saveThemePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference)
  applyTheme(preference)
}

export function watchSystemTheme(
  preference: ThemePreference,
  onChange: () => void,
): () => void {
  if (preference !== 'system') return () => undefined
  const media = matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
