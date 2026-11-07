import { Loader2Icon } from 'lucide-react'
import { cn } from 'cn'

/** Decorative spinner. Wrap it in an element that announces the loading state. */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
