import { ArrowUp, Camera, ShieldCheck } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'
import { KindTag } from '@/features/processing/components/StepRail'
import { type LiveViewState, STEPS } from '@/features/processing/steps'
import { cn } from '@/lib/utils'
import { ACCEPT_ATTRIBUTE, validateReceiptFile } from '../file-validation'
import { useUploadReceipt } from '../queries'

/** Drawn receipt with an upload badge; purely decorative. */
function ReceiptIllustration({ uploading }: { uploading: boolean }) {
  return (
    <div aria-hidden="true" className="relative h-32 w-28 shrink-0 sm:h-36 sm:w-30">
      <div className="absolute top-3.5 left-4 h-28 w-20 rotate-6 rounded bg-[#eceae2]" />
      <div
        className={cn(
          'absolute top-2 left-4 flex h-28 w-20 flex-col gap-1.5 rounded border border-[#dedbd0] bg-paper px-3 py-3.5',
          !uploading && 'animate-float motion-reduce:animate-none',
        )}
      >
        <div className="mx-auto h-1 w-3/5 rounded-sm bg-[#bdb9ae]" />
        {[80, 66, 74, 50].map((width) => (
          <div
            key={width}
            className="h-1 rounded-sm bg-[#d3cfc4] first:mt-1.5"
            style={{ width: `${width}%` }}
          />
        ))}
        <div className="mt-1.5 ml-auto h-1 w-2/5 rounded-sm bg-primary" />
        {uploading && (
          <div className="absolute inset-0 animate-scan">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-success" />
          </div>
        )}
      </div>
      <div className="absolute right-0 bottom-1 grid size-10 place-items-center rounded-full bg-brand shadow-[0_6px_16px_rgba(18,20,18,.15)]">
        {uploading ? (
          <Spinner className="size-5 text-brand-foreground" />
        ) : (
          <ArrowUp className="size-5 text-brand-foreground" strokeWidth={2.2} />
        )}
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <aside
      aria-labelledby="how-it-works-title"
      className="flex flex-col gap-4 rounded-3xl bg-ink p-6 text-ink-foreground sm:p-7"
    >
      <h3 id="how-it-works-title" className="text-[15px] font-semibold">
        So läuft die Verarbeitung
      </h3>
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((step, index) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-brand tabular">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="flex-1">{step.activity}</span>
            <KindTag kind={step.kind} />
          </li>
        ))}
      </ol>
      <p className="mt-auto text-[13px] leading-normal text-ink-muted">
        Nur ein Schritt nutzt KI. Die CO₂-Werte rechnet getesteter Code, jeder mit Quelle.
      </p>
    </aside>
  )
}

export function ReceiptUpload() {
  const auth = useAuth()
  const upload = useUploadReceipt()
  const navigate = useNavigate()
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  if (auth.status !== 'authenticated') return null
  const userId = auth.user.id

  function handleFile(file: File | undefined) {
    if (!file || upload.isPending) return
    upload.reset()
    const result = validateReceiptFile(file)
    if (!result.ok) {
      setValidationError(result.error)
      return
    }
    setValidationError(null)
    upload.mutate(
      { file, userId },
      {
        onSuccess: ({ receipt }) => {
          const state: LiveViewState = { fromUpload: true }
          void navigate(`/receipts/${receipt.id}/live`, { state })
        },
        onSettled: () => {
          if (inputRef.current) inputRef.current.value = ''
        },
      },
    )
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0])
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    handleFile(event.dataTransfer.files[0])
  }

  const error =
    validationError ??
    (upload.isError ? 'Der Upload ist fehlgeschlagen. Bitte versuche es erneut.' : null)

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"
    >
      <h2 id={`${inputId}-title`} className="sr-only">
        Beleg hochladen
      </h2>

      <div className="relative min-w-0">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="peer sr-only"
          aria-describedby={hintId}
          disabled={upload.isPending}
          onChange={onChange}
        />
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag & drop is a pointer-only enhancement; the file input is the keyboard path */}
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex h-full cursor-pointer flex-col items-start gap-6 rounded-3xl border-[1.5px] border-dashed border-input bg-card p-6 transition-[border-color,box-shadow,background-color] duration-200 sm:flex-row sm:items-center sm:gap-8 sm:p-9',
            'hover:border-primary hover:shadow-[0_0_0_6px_color-mix(in_oklab,var(--brand)_35%,transparent)]',
            'peer-focus-visible:border-primary peer-focus-visible:shadow-[0_0_0_6px_color-mix(in_oklab,var(--brand)_55%,transparent)]',
            'peer-disabled:cursor-wait',
            isDragging &&
              'border-primary bg-brand/10 shadow-[0_0_0_6px_color-mix(in_oklab,var(--brand)_45%,transparent)]',
          )}
        >
          <ReceiptIllustration uploading={upload.isPending} />
          <span className="flex min-w-0 flex-col gap-2.5">
            <span className="text-2xl font-semibold tracking-tight">
              {upload.isPending ? 'Wird hochgeladen …' : 'Bon hier ablegen'}
            </span>
            <span id={hintId} className="text-[15px] leading-relaxed text-muted-foreground">
              {upload.isPending
                ? `„${upload.variables.file.name}“ wird vorbereitet und sicher gespeichert. Gleich siehst du jeden Schritt live.`
                : 'oder ein Foto auswählen. JPG, PNG, WebP oder HEIC, bis 10 MB. Danach zeigen wir dir live jeden Schritt.'}
            </span>
            {!upload.isPending && (
              <span className="mt-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground">
                <Camera aria-hidden className="size-4" />
                Foto auswählen
              </span>
            )}
          </span>
        </label>
      </div>

      <HowItWorks />

      {error && (
        <Alert variant="destructive" role="alert" className="lg:col-span-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="flex gap-2 text-[13px] leading-normal text-muted-foreground lg:col-span-2">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Hinweis zum Datenschutz: Belege werden zur Analyse an einen KI-Dienst (Google Gemini bzw.
          Groq, jeweils Free Tier) übertragen. Diese Anbieter können Daten im kostenlosen Tarif zur
          Verbesserung ihrer Modelle verwenden. Lade keine Dokumente mit sensiblen Daten hoch.
        </span>
      </p>
    </section>
  )
}
