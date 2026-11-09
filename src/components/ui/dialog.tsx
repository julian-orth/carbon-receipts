import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTitle = DialogPrimitive.Title
const DialogDescription = DialogPrimitive.Description
const DialogClose = DialogPrimitive.Close

/**
 * Centered card from `sm` up; below that a bottom sheet, so long content stays
 * reachable with the thumb and the page behind remains visible at the top.
 */
function DialogContent({
  className,
  children,
  closeLabel = 'Schließen',
  animated = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  closeLabel?: string
  /** false: appear without entrance animation (e.g. when continuing another dialog). */
  animated?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-foreground/25 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 supports-backdrop-filter:backdrop-blur-[2px]',
          animated && 'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden bg-card text-card-foreground shadow-[0_24px_64px_rgba(18,20,18,.22)] outline-none',
          'inset-x-0 bottom-0 max-h-[92svh] rounded-t-2xl',
          'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(90svh,52rem)] sm:w-[calc(100%-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border',
          animated &&
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-[.97]',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X aria-hidden className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle }
