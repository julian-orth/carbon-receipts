import { Spinner } from '@/components/ui/spinner'

export function FullPageSpinner({ label = 'Lädt' }: { label?: string }) {
  return (
    <output aria-label={label} className="grid min-h-[50svh] place-items-center">
      <Spinner className="size-6 text-muted-foreground" />
    </output>
  )
}
