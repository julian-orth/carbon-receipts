import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { useUploadFlow } from './upload-flow-context'

/** "Beleg hochladen" for any page: opens the camera or gallery and starts the shared upload flow. */
export function UploadButton({
  variant = 'default',
  compact = false,
  className,
}: {
  variant?: 'default' | 'outline'
  /** Icon only on phones (the label stays for screen readers); for tight places like the header. */
  compact?: boolean
  className?: string
}) {
  const auth = useAuth()
  const { openPicker, isUploading } = useUploadFlow()
  if (auth.status !== 'authenticated') return null
  return (
    <Button
      type="button"
      variant={variant}
      onClick={openPicker}
      disabled={isUploading}
      className={cn('h-10 rounded-full', compact ? 'px-3.5 sm:px-4' : 'px-4', className)}
    >
      {isUploading ? <Spinner /> : <Camera aria-hidden />}
      <span className={cn(compact && 'max-sm:sr-only')}>Beleg hochladen</span>
    </Button>
  )
}
