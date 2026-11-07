import { ShieldAlert, Upload } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { ACCEPT_ATTRIBUTE, validateReceiptFile } from '../file-validation'
import { useUploadReceipt } from '../queries'

export function ReceiptUpload() {
  const auth = useAuth()
  const upload = useUploadReceipt()
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
    <section aria-labelledby={`${inputId}-title`} className="space-y-3">
      <h2 id={`${inputId}-title`} className="text-lg font-semibold">
        Beleg hochladen
      </h2>

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
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          'peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:outline-none hover:bg-muted/50',
          'peer-disabled:cursor-wait peer-disabled:opacity-70',
          isDragging && 'border-primary bg-muted/50',
        )}
      >
        {upload.isPending ? (
          <Spinner className="size-6 text-muted-foreground" />
        ) : (
          <Upload aria-hidden className="size-6 text-muted-foreground" />
        )}
        <span className="font-medium">
          {upload.isPending ? 'Wird hochgeladen …' : 'Foto oder CSV auswählen'}
        </span>
        <span id={hintId} className="text-sm text-muted-foreground">
          oder hierher ziehen · JPG, PNG, WebP, HEIC oder CSV · max. 10 MB
        </span>
      </label>

      <div aria-live="polite" className="min-h-0">
        {upload.isSuccess && (
          <p className="text-sm text-muted-foreground">
            „{upload.variables.file.name}“ wurde hochgeladen und wird gleich analysiert.
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="flex gap-2 text-xs text-muted-foreground">
        <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Hinweis zum Datenschutz: Belege werden zur Analyse an einen KI-Dienst (Google Gemini bzw.
          Groq, jeweils Free Tier) übertragen. Diese Anbieter können Daten im kostenlosen Tarif zur
          Verbesserung ihrer Modelle verwenden. Lade keine Dokumente mit sensiblen Daten hoch.
        </span>
      </p>
    </section>
  )
}
