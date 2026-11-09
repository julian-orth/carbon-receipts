import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const PLACEHOLDER_ROWS = [54, 36, 0, 74, 66, 58, 70, 46, 78, 34, 0, 40, 30]

type ReceiptPhotoProps = {
  url: string | null
  loading: boolean
  scanning: boolean
  className?: string
}

/** The uploaded photo; while the AI reads it, a scan line runs over it. */
export function ReceiptPhoto({ url, loading, scanning, className }: ReceiptPhotoProps) {
  const [broken, setBroken] = useState<string | null>(null)
  const showImage = url !== null && broken !== url

  return (
    <div
      className={cn('relative aspect-[3/4] overflow-hidden rounded-xl border bg-paper', className)}
    >
      {loading ? (
        <Skeleton className="size-full rounded-none bg-paper-line/60" />
      ) : showImage ? (
        <img
          src={url}
          alt="Foto des Belegs"
          decoding="async"
          onError={() => setBroken(url)}
          className="size-full object-cover object-top"
        />
      ) : (
        // Formats the browser cannot show (HEIC outside Safari) get a drawn receipt.
        <div aria-hidden="true" className="flex h-full flex-col gap-2 px-4 py-5">
          {PLACEHOLDER_ROWS.map((width, index) =>
            width === 0 ? (
              <div key={index} className="h-1.5" />
            ) : (
              <div
                key={index}
                className="h-1.5 rounded-[2px] bg-paper-line"
                style={{ width: `${width}%`, marginInline: index < 2 ? 'auto' : undefined }}
              />
            ),
          )}
        </div>
      )}
      {scanning && (
        <div aria-hidden="true" className="absolute inset-0 animate-scan motion-reduce:hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_16px_4px_rgba(200,241,105,.55)]" />
        </div>
      )}
    </div>
  )
}
