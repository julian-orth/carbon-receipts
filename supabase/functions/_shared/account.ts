/** The shared demo account must not be deletable by a visitor. Compared case-insensitively. */
export function isDemoAccount(email: string | undefined, demoEmail: string | undefined): boolean {
  if (!email || !demoEmail) return false
  return email.trim().toLowerCase() === demoEmail.trim().toLowerCase()
}

/** Files of a user live under `<userId>/` in the receipts bucket (see the upload). */
export function userFolder(userId: string): string {
  return userId
}

/**
 * True if `path` is a file directly in the user's folder. The service role bypasses Storage
 * policies, so this guards every download it does on a user's behalf (the DB checks it too).
 */
export function isOwnFile(path: string, userId: string): boolean {
  const prefix = `${userFolder(userId)}/`
  return path.startsWith(prefix) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path.slice(prefix.length))
}
