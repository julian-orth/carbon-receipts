import { Download, LogOut, Trash2 } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'
import { demoCredentials, useSignOut } from '@/features/auth/mutations'
import { useReceipts, useReceiptTotals } from '@/features/receipts/queries'
import { formatDate } from '@/lib/format'
import { formatCo2e } from '@/lib/format-co2'
import { cn } from '@/lib/utils'
import { accountStats, parseDisplayName, quotaUsage } from './account-logic'
import { DemoAccountError } from './api'
import {
  useAiUsageToday,
  useDeleteAccount,
  useExportData,
  useProfile,
  useUpdateDisplayName,
} from './queries'

function Section({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string
  description?: string
  children: ReactNode
  tone?: 'default' | 'danger'
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={
        tone === 'danger'
          ? 'space-y-4 rounded-3xl border border-destructive/30 bg-card p-5 sm:p-6'
          : 'space-y-4 rounded-3xl border bg-card p-5 sm:p-6'
      }
    >
      <div>
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tracking-tight">{value}</dd>
    </div>
  )
}

export function AccountPage() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  const isDemo = demoCredentials !== null && auth.user.email === demoCredentials.email

  return (
    <div className="space-y-8">
      <title>Konto · Carbon Receipts</title>
      <header className="animate-rise">
        <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-[44px] sm:leading-[1.05]">
          Konto
        </h1>
        <p className="mt-2.5 text-base text-muted-foreground sm:text-[17px]">
          Deine Angaben, deine Nutzung und deine Daten.
        </p>
      </header>

      {isDemo && (
        <Alert>
          <AlertTitle>Das ist das gemeinsame Demo-Konto</AlertTitle>
          <AlertDescription>
            Es enthält Beispieldaten und wird von allen Besuchern geteilt. Name ändern und Löschen
            sind hier deshalb ausgeschaltet.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <ProfileSection userId={auth.user.id} email={auth.user.email ?? ''} disabled={isDemo} />
        <UsageSection />
        <DataSection email={auth.user.email} />
        <DangerSection isDemo={isDemo} />
      </div>
    </div>
  )
}

function ProfileSection({
  userId,
  email,
  disabled,
}: {
  userId: string
  email: string
  disabled: boolean
}) {
  const profile = useProfile()
  const update = useUpdateDisplayName(userId)
  const signOut = useSignOut()
  const nameId = useId()
  const errorId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const saved = profile.data?.display_name ?? ''
  const value = draft ?? saved
  const dirty = draft !== null && draft.trim() !== saved

  function save() {
    const parsed = parseDisplayName(value)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setError(null)
    update.mutate(parsed.value, { onSuccess: () => setDraft(null) })
  }

  return (
    <Section title="Profil" description="So erscheinst du in der App.">
      {profile.isPending ? (
        <Skeleton aria-label="Profil wird geladen" className="h-32 w-full rounded-2xl" />
      ) : profile.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Profil konnte nicht geladen werden</AlertTitle>
          <AlertDescription>
            <Button variant="outline" size="sm" onClick={() => void profile.refetch()}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={nameId}>Name (optional)</Label>
            <Input
              id={nameId}
              value={value}
              disabled={disabled}
              autoComplete="name"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setDraft(event.target.value)}
              className="h-11"
            />
            {error && (
              <p id={errorId} className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">E-Mail-Adresse</dt>
              <dd className="mt-0.5 break-all">{email}</dd>
            </div>
            {profile.data && (
              <div>
                <dt className="text-xs text-muted-foreground">Dabei seit</dt>
                <dd className="mt-0.5">{formatDate(profile.data.created_at)}</dd>
              </div>
            )}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={disabled || !dirty || update.isPending}>
              {update.isPending && <Spinner />}
              Speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
            >
              {signOut.isPending ? <Spinner /> : <LogOut aria-hidden />}
              Abmelden
            </Button>
          </div>
          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              Der Name konnte nicht gespeichert werden.
            </p>
          )}
          {update.isSuccess && !dirty && (
            <output className="block text-sm text-muted-foreground">Gespeichert.</output>
          )}
        </form>
      )}
    </Section>
  )
}

function UsageSection() {
  const receipts = useReceipts()
  const totals = useReceiptTotals()
  const profile = useProfile()
  const usage = useAiUsageToday()

  const ready = receipts.isSuccess && totals.isSuccess
  const failed = receipts.isError || totals.isError
  const stats = ready ? accountStats(receipts.data, totals.data) : null
  const quota =
    profile.data && usage.data !== undefined
      ? quotaUsage(usage.data, profile.data.daily_ai_quota)
      : null

  return (
    <Section title="Nutzung" description="Was du bisher erfasst hast.">
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Die Nutzung konnte nicht geladen werden.
        </p>
      ) : !stats ? (
        <Skeleton aria-label="Nutzung wird geladen" className="h-32 w-full rounded-2xl" />
      ) : stats.receipts === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Belege. Lade deinen ersten Kassenbon hoch, dann erscheinen hier deine Zahlen.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
          <Stat label="Belege insgesamt" value={stats.receipts.toLocaleString('de-DE')} />
          <Stat label="Bestätigt" value={stats.confirmed.toLocaleString('de-DE')} />
          <Stat label="CO₂e aus bestätigten Belegen" value={formatCo2e(stats.co2eKg)} />
          <Stat label="Erfasste Produkte" value={stats.items.toLocaleString('de-DE')} />
          {stats.inReview > 0 && (
            <Stat label="Warten auf deine Prüfung" value={stats.inReview.toLocaleString('de-DE')} />
          )}
          {stats.failed > 0 && (
            <Stat label="Fehlgeschlagen" value={stats.failed.toLocaleString('de-DE')} />
          )}
        </dl>
      )}

      {quota && (
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">KI-Analysen heute</span>
            <span className="font-mono tabular">
              {quota.used} von {quota.quota}
            </span>
          </div>
          <progress
            aria-label="KI-Analysen heute"
            max={quota.quota}
            value={Math.min(quota.used, quota.quota)}
            className={cn(
              'h-2 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:rounded-full',
              quota.remaining === 0
                ? '[&::-moz-progress-bar]:bg-destructive [&::-webkit-progress-value]:bg-destructive'
                : '[&::-moz-progress-bar]:bg-primary [&::-webkit-progress-value]:bg-primary',
            )}
          />
          <p className="text-xs text-muted-foreground">
            {quota.remaining === 0
              ? 'Das Tageslimit ist erreicht. Morgen geht es weiter.'
              : `Noch ${quota.remaining} Analysen heute. Das Limit schützt die kostenlosen KI-Dienste.`}
          </p>
        </div>
      )}
    </Section>
  )
}

function download(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function DataSection({ email }: { email: string | undefined }) {
  const exportData = useExportData(email)

  function startExport() {
    exportData.mutate(undefined, {
      onSuccess: (bundle) => {
        const day = new Date().toISOString().slice(0, 10)
        download(`carbon-receipts-daten-${day}.json`, JSON.stringify(bundle, null, 2))
      },
    })
  }

  return (
    <Section
      title="Deine Daten"
      description="Du behältst die Kontrolle: herunterladen, nachlesen, löschen."
    >
      <p className="text-sm text-muted-foreground">
        Gespeichert sind deine E-Mail-Adresse, deine Belegfotos, die erkannten Positionen mit
        Korrekturen und dein Monatsziel. Der Download enthält alles außer den Fotos selbst.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={startExport} disabled={exportData.isPending}>
          {exportData.isPending ? <Spinner /> : <Download aria-hidden />}
          Meine Daten herunterladen
        </Button>
      </div>
      {exportData.isError && (
        <p role="alert" className="text-sm text-destructive">
          Der Download hat nicht geklappt. Bitte versuche es erneut.
        </p>
      )}
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li>
          <Link to="/datenschutz" className="underline underline-offset-4 hover:text-foreground">
            Datenschutzerklärung
          </Link>
        </li>
        <li>
          <Link to="/datenbasis" className="underline underline-offset-4 hover:text-foreground">
            Datenbasis der Berechnung
          </Link>
        </li>
        <li>
          <Link to="/impressum" className="underline underline-offset-4 hover:text-foreground">
            Impressum
          </Link>
        </li>
      </ul>
    </Section>
  )
}

function DangerSection({ isDemo }: { isDemo: boolean }) {
  const remove = useDeleteAccount()
  const confirmId = useId()
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const matches = phrase.trim().toLocaleLowerCase('de') === 'löschen'

  return (
    <Section
      tone="danger"
      title="Konto löschen"
      description="Das lässt sich nicht rückgängig machen."
    >
      <p className="text-sm text-muted-foreground">
        Dein Konto, alle Belege samt Fotos, alle Positionen und dein Ziel werden dauerhaft gelöscht.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (remove.isPending) return
          setOpen(next)
          if (!next) {
            setPhrase('')
            remove.reset()
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isDemo}>
            <Trash2 aria-hidden />
            Konto löschen …
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konto wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle deine Belege, Fotos und Auswertungen verschwinden dauerhaft. Lade vorher deine
              Daten herunter, wenn du sie behalten möchtest.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (matches) remove.mutate()
            }}
          >
            <Label htmlFor={confirmId}>Tippe „löschen“, um zu bestätigen</Label>
            <Input
              id={confirmId}
              value={phrase}
              autoComplete="off"
              onChange={(event) => setPhrase(event.target.value)}
              className="h-11"
            />
            {remove.isError && (
              <p role="alert" className="text-sm text-destructive">
                {remove.error instanceof DemoAccountError
                  ? 'Das Demo-Konto kann nicht gelöscht werden.'
                  : 'Das Löschen hat nicht geklappt. Dein Konto ist unverändert. Bitte versuche es erneut.'}
              </p>
            )}
            <AlertDialogFooter className="pt-2">
              <AlertDialogCancel disabled={remove.isPending}>Abbrechen</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={!matches || remove.isPending}>
                {remove.isPending && <Spinner />}
                Endgültig löschen
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {isDemo && (
        <p className="text-sm text-muted-foreground">
          Das gemeinsame Demo-Konto kann nicht gelöscht werden.
        </p>
      )}
    </Section>
  )
}
