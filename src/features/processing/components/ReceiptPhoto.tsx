import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const PLACEHOLDER_ROWS = [54, 36, 0, 74, 66, 58, 70, 46, 78, 34, 0, 40, 30]

type ReceiptPhotoProps = {
  url: string | null
  loading: boolean
  scanning: boolean
  caption: string
}

/** The uploaded photo; while the AI reads it, a scan line runs over it. */
export function ReceiptPhoto({ url, loading, scanning, caption }: ReceiptPhotoProps) {
  const [broken, setBroken] = useState<string | null>(null)
  const showImage = url !== null && broken !== url

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-ink-line bg-ink-raised p-6">
        <div className="relative h-full -rotate-[1.6deg] overflow-hidden rounded-sm bg-paper shadow-[0_24px_48px_rgba(0,0,0,.45)]">
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
            <div aria-hidden="true" className="flex h-full flex-col gap-2.5 px-5 py-6">
              {PLACEHOLDER_ROWS.map((width, index) =>
                width === 0 ? (
                  <div key={index} className="h-2" />
                ) : (
                  <div
                    key={index}
                    className="h-[7px] rounded-[2px] bg-[#aba79b]"
                    style={{ width: `${width}%`, marginInline: index < 2 ? 'auto' : undefined }}
                  />
                ),
              )}
            </div>
          )}
          {scanning && (
            <div aria-hidden="true" className="absolute inset-0 animate-scan motion-reduce:hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_22px_6px_rgba(200,241,105,.4)]" />
            </div>
          )}
        </div>
      </div>
      <figcaption className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        {scanning && (
          <span
            aria-hidden="true"
            className="size-1.5 animate-blink rounded-full bg-brand motion-reduce:animate-none"
          />
        )}
        {caption}
      </figcaption>
    </figure>
  )
}
