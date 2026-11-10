/** The shared demo account must not be deletable by a visitor. Compared case-insensitively. */
export function isDemoAccount(email: string | undefined, demoEmail: string | undefined): boolean {
  if (!email || !demoEmail) return false
  return email.trim().toLowerCase() === demoEmail.trim().toLowerCase()
}

/** Files of a user live under `<userId>/` in the receipts bucket (see the upload). */
export function userFolder(userId: string): string {
  return userId
}
