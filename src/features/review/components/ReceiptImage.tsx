import { ImageOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useReceiptImage } from '../queries'

export function ReceiptImage({ path }: { path: string | null }) {
  const image = useReceiptImage(path)

  if (path === null || image.isError) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
        <ImageOff aria-hidden className="size-6" />
        Foto nicht verfügbar
      </div>
    )
  }
  if (image.isPending) return <Skeleton className="h-96 w-full" />

  return (
    <a href={image.data} target="_blank" rel="noreferrer" className="block">
      <img
        src={image.data}
        alt="Foto des Kassenbons (öffnet in neuem Tab)"
        className="max-h-[70svh] w-full rounded-lg border object-contain"
      />
    </a>
  )
}
