import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LEGAL, type LegalConfig, missingLegalFields } from './legal-config'

/** A configured value, or a visible placeholder so a missing detail cannot go unnoticed. */
export function Field({ name }: { name: keyof LegalConfig }) {
  const value = LEGAL[name]?.trim()
  return value ? (
    <>{value}</>
  ) : (
    <mark className="rounded bg-warning-soft px-1 text-warning-foreground">
      [noch ergänzen: {name}]
    </mark>
  )
}

/** Shared frame of the legal pages: readable column, warning while details are missing. */
export function LegalPage({
  title,
  required,
  children,
}: {
  title: string
  required: (keyof LegalConfig)[]
  children: ReactNode
}) {
  const missing = missingLegalFields(LEGAL, required)
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <title>{`${title} · Carbon Receipts`}</title>
      <header className="space-y-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Zur App
        </Link>
        <h1 className="text-4xl font-semibold tracking-[-0.035em]">{title}</h1>
      </header>
      {missing.length > 0 && (
        <p
          role="note"
          className="flex gap-2 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning-foreground"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Angaben fehlen noch ({missing.join(', ')}) und müssen vor der Veröffentlichung in
            <code className="mx-1">legal-config.ts</code> ergänzt werden.
          </span>
        </p>
      )}
      <div className="space-y-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  )
}
