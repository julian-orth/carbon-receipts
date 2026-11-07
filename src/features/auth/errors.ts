import { isAuthError } from '@supabase/supabase-js'

/** Maps Supabase auth errors to user-facing (German) messages. */
export function getAuthErrorMessage(error: unknown): string {
  if (isAuthError(error)) {
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return 'Zu viele Anfragen. Bitte warte einen Moment und versuche es dann erneut.'
    }
    if (error.code === 'otp_expired') {
      return 'Der Login-Link ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen an.'
    }
    if (error.code === 'email_address_invalid') {
      return 'Diese E-Mail-Adresse wird nicht akzeptiert.'
    }
  }
  if (error instanceof TypeError) {
    return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.'
  }
  return 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'
}
