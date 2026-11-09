import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from './auth-context'
import { getAuthErrorMessage } from './errors'
import { demoCredentials, useDemoSignIn, useSendMagicLink } from './mutations'
import { consumeRedirect, rememberRedirect, sanitizeRedirect } from './redirect'

const loginSchema = z.object({
  email: z.email('Bitte gib eine gültige E-Mail-Adresse ein.').trim().toLowerCase(),
})
type LoginForm = z.infer<typeof loginSchema>

/** Router state is untyped (`any`); read `from` without trusting its shape. */
function readFrom(state: unknown): unknown {
  return typeof state === 'object' && state !== null && 'from' in state ? state.from : undefined
}

const MAILPIT_URL = 'http://127.0.0.1:54324'

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const from = sanitizeRedirect(readFrom(location.state))

  const sendMagicLink = useSendMagicLink()
  const demoSignIn = useDemoSignIn()
  const emailId = useId()
  const emailErrorId = useId()
  const successHeadingRef = useRef<HTMLHeadingElement>(null)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  })
  const emailError = form.formState.errors.email?.message

  // Move focus to the confirmation so screen reader users notice the change.
  useEffect(() => {
    if (sendMagicLink.isSuccess) successHeadingRef.current?.focus()
  }, [sendMagicLink.isSuccess])

  if (auth.status === 'authenticated') {
    return <Navigate to={consumeRedirect()} replace />
  }

  const onSubmit = form.handleSubmit(({ email }) => {
    rememberRedirect(from)
    sendMagicLink.mutate(email)
  })

  return (
    <div className="mx-auto max-w-sm py-8">
      <title>Anmelden · Carbon Receipts</title>
      <Card>
        {sendMagicLink.isSuccess ? (
          <>
            <CardHeader>
              <MailCheck aria-hidden className="mb-2 size-8 text-primary" />
              <CardTitle>
                <h1 ref={successHeadingRef} tabIndex={-1} className="outline-none">
                  Prüfe dein Postfach
                </h1>
              </CardTitle>
              <CardDescription>
                Wir haben einen Login-Link an <strong>{sendMagicLink.variables}</strong> geschickt.
                Der Link ist eine Stunde gültig.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {import.meta.env.DEV && (
                <p className="text-sm text-muted-foreground">
                  Lokale Entwicklung: Mails landen in{' '}
                  <a
                    href={MAILPIT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    Mailpit
                  </a>
                  .
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={() => sendMagicLink.reset()}>
                Andere E-Mail-Adresse verwenden
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>
                <h1>Anmelden</h1>
              </CardTitle>
              <CardDescription>
                Wir schicken dir einen Link per E-Mail – kein Passwort nötig.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={emailId}>E-Mail-Adresse</Label>
                  <Input
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="du@example.com"
                    aria-invalid={emailError ? true : undefined}
                    aria-describedby={emailError ? emailErrorId : undefined}
                    {...form.register('email')}
                  />
                  {emailError && (
                    <p id={emailErrorId} className="text-sm text-destructive">
                      {emailError}
                    </p>
                  )}
                </div>

                {sendMagicLink.isError && (
                  <Alert variant="destructive" role="alert">
                    <AlertTitle>Login-Link konnte nicht gesendet werden</AlertTitle>
                    <AlertDescription>{getAuthErrorMessage(sendMagicLink.error)}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={sendMagicLink.isPending}>
                  {sendMagicLink.isPending && <Spinner />}
                  {sendMagicLink.isPending ? 'Wird gesendet …' : 'Login-Link senden'}
                </Button>
              </form>

              {demoCredentials && (
                <div className="mt-6 space-y-2 border-t pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={demoSignIn.isPending}
                    onClick={() => {
                      rememberRedirect(from)
                      demoSignIn.mutate()
                    }}
                  >
                    {demoSignIn.isPending && <Spinner />}
                    Demo ansehen
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Mit Beispieldaten, ohne Anmeldung. Die Demo wird regelmäßig zurückgesetzt.
                  </p>
                  {demoSignIn.isError && (
                    <p role="alert" className="text-center text-sm text-destructive">
                      {getAuthErrorMessage(demoSignIn.error)}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
