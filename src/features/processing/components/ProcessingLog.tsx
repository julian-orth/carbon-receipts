import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type LogEntry, type LogTone } from '../progress'
import { formatClock } from '../steps'

const TONE: Record<LogTone, string> = {
  neutral: 'text-foreground/80',
  ok: 'text-success',
  warn: 'text-warning-foreground',
  danger: 'text-destructive',
}

/** Collapsible protocol: details for the curious, out of the way for everyone else. */
export function ProcessingLog({
  entries,
  defaultOpen = false,
}: {
  entries: readonly LogEntry[]
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border bg-muted/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
        />
        Protokoll
        <span className="font-normal text-muted-foreground">({entries.length})</span>
      </summary>
      <div role="log" aria-label="Protokoll" className="px-3 pb-3">
        <ol className="flex flex-col gap-1.5 font-mono text-xs leading-snug">
          {entries.map((entry, index) => (
            <li key={`${index}-${entry.text}`} className="flex gap-3">
              <span className="shrink-0 text-muted-foreground tabular">
                {formatClock(entry.at)}
              </span>
              <span className={cn('min-w-0 break-words', TONE[entry.tone])}>{entry.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  )
}
