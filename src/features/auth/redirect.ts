const STORAGE_KEY = 'carbon-receipts:auth-redirect'
export const DEFAULT_REDIRECT = '/'

/**
 * Only allow same-origin, absolute paths. Rejects protocol-relative URLs (`//evil.com`),
 * backslash tricks (`/\evil.com`) and anything that is not a path.
 */
export function sanitizeRedirect(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_REDIRECT
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_REDIRECT
  }
  if (value.startsWith('/login') || value.startsWith('/auth/')) return DEFAULT_REDIRECT
  return value
}

// localStorage (not sessionStorage): the magic link usually opens in a new tab.
export function rememberRedirect(path: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, sanitizeRedirect(path))
  } catch {
    // Storage unavailable (private mode) – fall back to the default target.
  }
}

export function consumeRedirect(): string {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    return sanitizeRedirect(value)
  } catch {
    return DEFAULT_REDIRECT
  }
}
