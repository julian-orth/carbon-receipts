import { FileImage } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { loadSampleReceipt, SampleReceiptError } from './sample-receipt'
import { useUploadFlow } from './upload-flow-context'

/** Runs the whole flow with the example receipt – for visitors without a bon at hand. */
export function SampleReceiptButton({ className }: { className?: string }) {
  const { uploadFile, isUploading } = useUploadFlow()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runSample() {
    setError(null)
    setLoading(true)
    try {
      uploadFile(await loadSampleReceipt())
    } catch (caught) {
      setError(
        caught instanceof SampleReceiptError
          ? caught.message
          : 'Der Beispielbeleg konnte nicht geladen werden.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant="ghost"
        onClick={() => void runSample()}
        disabled={isUploading || loading}
        className={className}
      >
        {loading ? <Spinner /> : <FileImage aria-hidden />}
        Beispielbeleg ausprobieren
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
