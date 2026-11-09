import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

/** Same key as `public/theme-init.js`, which applies the theme before the first paint. */
const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const THEME_COLOR = { light: '#f5f5f1', dark: '#0d0f0d' } as const

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // Storage can be blocked (private mode, site data off): fall back to the system.
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

function apply(preference: ThemePreference) {
  const theme = resolveTheme(preference, systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

const listeners = new Set<() => void>()
let preference: ThemePreference = typeof window === 'undefined' ? 'system' : readPreference()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // With "system", follow the OS switching between light and dark while the app is open.
  const media = typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null
  const onSystemChange = () => {
    if (preference === 'system') apply(preference)
    listener()
  }
  media?.addEventListener('change', onSystemChange)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', onSystemChange)
  }
}

export function setThemePreference(next: ThemePreference) {
  preference = next
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Not persisted, but still applied for this visit.
  }
  apply(next)
  notify()
}

/** The chosen preference and the theme actually shown. */
export function useTheme() {
  const current = useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'system' as const,
  )
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(preference, systemPrefersDark()),
    () => 'light' as const,
  )
  return { preference: current, resolved, setPreference: setThemePreference }
}
