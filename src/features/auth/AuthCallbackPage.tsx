import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { consumeRedirect } from './redirect'

/** Errors are returned in the query (PKCE) or in the hash (implicit flow). */
function readCallbackError(): string | null {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const code = query.get('error_code') ?? hash.get('error_code')
  if (code === 'otp_expired') {
    return 'Der Login-Link ist abgelaufen oder wurde bereits verwendet.'
  }
  const description = query.get('error_description') ?? hash.get('error_description')
  return description ? description.replaceAll('+', ' ') : null
}

/**
 * Landing page of the magic link. supabase-js exchanges the `?code=` itself
 * (detectSessionInUrl); this page only waits for the result and redirects.
 */
export function AuthCallbackPage() {
  const auth = useAuth()
  const [callbackError] = useState(readCallbackError)

  if (auth.status === 'authenticated') {
    return <Navigate to={consumeRedirect()} replace />
  }

  if (auth.status === 'loading' && !callbackError) {
    return <FullPageSpinner label="Anmeldung wird abgeschlossen" />
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-8">
      <title>Anmeldung fehlgeschlagen · Carbon Receipts</title>
      <h1 className="text-2xl font-semibold">Anmeldung fehlgeschlagen</h1>
      <Alert variant="destructive" role="alert">
        <AlertTitle>Der Link hat nicht funktioniert</AlertTitle>
        <AlertDescription>
          {callbackError ??
            'Der Link ist ungültig oder wurde in einem anderen Browser geöffnet. Öffne ihn im selben Browser, in dem du ihn angefordert hast.'}
        </AlertDescription>
      </Alert>
      <Button asChild className="w-full">
        <Link to="/login">Neuen Link anfordern</Link>
      </Button>
    </div>
  )
}
