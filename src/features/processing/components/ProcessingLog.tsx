import { cn } from '@/lib/utils'
import { type LogEntry, type LogTone } from '../progress'
import { formatClock } from '../steps'

const TONE: Record<LogTone, string> = {
  neutral: 'text-ink-foreground/80',
  ok: 'text-brand',
  warn: 'text-ink-warning',
  danger: 'text-ink-danger',
}

export function ProcessingLog({ entries }: { entries: readonly LogEntry[] }) {
  return (
    <section aria-labelledby="processing-log-title" className="border-t border-ink-line pt-5">
      <h2
        id="processing-log-title"
        className="mb-3.5 font-mono text-xs font-medium tracking-widest text-ink-muted uppercase"
      >
        Protokoll
      </h2>
      <div role="log" aria-labelledby="processing-log-title">
        <ol className="flex flex-col gap-2.5 font-mono text-[13px] leading-snug">
          {entries.map((entry, index) => (
            <li key={`${index}-${entry.text}`} className="flex animate-rise gap-3.5">
              <span className="shrink-0 text-ink-subtle tabular">{formatClock(entry.at)}</span>
              <span className={cn('min-w-0 break-words', TONE[entry.tone])}>{entry.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
