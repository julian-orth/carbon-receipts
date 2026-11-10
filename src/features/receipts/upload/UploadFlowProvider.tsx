import { X } from 'lucide-react'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/features/auth/auth-context'
import type { LiveViewState } from '@/features/processing/steps'
import { UploadProgressDialog } from '@/features/processing/UploadProgressDialog'
import { ACCEPT_ATTRIBUTE, validateReceiptFile } from '../file-validation'
import { useUploadReceipt } from '../queries'
import { UploadFlowContext } from './upload-flow-context'

type Shown = { fileName: string; previewUrl: string | null; dismissed: boolean }

/**
 * Owns the hidden file input, the upload and its progress dialog for the whole app, so the
 * header, the dashboard and the receipts page all start the same flow.
 */
export function UploadFlowProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const userId = auth.status === 'authenticated' ? auth.user.id : null
  const upload = useUploadReceipt()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  // The progress dialog opens the moment a file is chosen, not after the upload.
  const [shown, setShown] = useState<Shown | null>(null)
  // Read in the upload's onSuccess, which closes over an older render.
  const dismissedRef = useRef(false)

  function closeDialog() {
    setShown((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }

  function startUpload(file: File) {
    if (!userId) return
    upload.mutate(
      { file, userId },
      {
        onSuccess: ({ receipt }) => {
          const stillWatching = !dismissedRef.current
          closeDialog()
          // Closed while uploading: the receipt simply shows up in the list.
          if (!stillWatching) return
          const state: LiveViewState = { fromUpload: true }
          void navigate(`/receipts/${receipt.id}`, { state })
        },
        onSettled: () => {
          if (inputRef.current) inputRef.current.value = ''
        },
      },
    )
  }

  function uploadFile(file: File | undefined) {
    if (!file || upload.isPending || !userId) return
    upload.reset()
    const result = validateReceiptFile(file)
    if (!result.ok) {
      setValidationError(result.error)
      return
    }
    setValidationError(null)
    closeDialog()
    const previewUrl =
      typeof URL.createObjectURL === 'function' && file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null
    dismissedRef.current = false
    setShown({ fileName: file.name, previewUrl, dismissed: false })
    startUpload(file)
  }

  const uploadingName = upload.isPending ? upload.variables.file.name : null
  const value = useMemo(
    () => ({
      openPicker: () => inputRef.current?.click(),
      uploadFile,
      isUploading: upload.isPending,
      uploadingName,
    }),
    // `uploadFile` only reads fresh state through the mutation and refs it closes over.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [upload.isPending, uploadingName, userId],
  )

  const error =
    validationError ??
    (upload.isError && !shown ? 'Der Upload ist fehlgeschlagen. Bitte versuche es erneut.' : null)

  return (
    <UploadFlowContext value={value}>
      {children}
      {userId && (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="upload-input"
          disabled={upload.isPending}
          onChange={(event) => uploadFile(event.target.files?.[0])}
        />
      )}

      {shown && !shown.dismissed && (upload.isPending || upload.isError) && (
        <UploadProgressDialog
          fileName={shown.fileName}
          previewUrl={shown.previewUrl}
          failed={upload.isError}
          onRetry={() => {
            if (upload.variables) startUpload(upload.variables.file)
          }}
          onChooseOther={() => {
            closeDialog()
            upload.reset()
            inputRef.current?.click()
          }}
          onOpenChange={(open) => {
            if (open) return
            if (upload.isError) {
              closeDialog()
              upload.reset()
            } else {
              dismissedRef.current = true
              setShown((current) => current && { ...current, dismissed: true })
            }
          }}
        />
      )}

      {error && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md">
          <Alert variant="destructive" role="alert" className="pr-12 shadow-lg">
            <AlertDescription>{error}</AlertDescription>
            <button
              type="button"
              aria-label="Meldung schließen"
              onClick={() => {
                setValidationError(null)
                upload.reset()
              }}
              className="absolute top-2 right-2 grid size-8 place-items-center rounded-full hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X aria-hidden className="size-4" />
            </button>
          </Alert>
        </div>
      )}
    </UploadFlowContext>
  )
}
