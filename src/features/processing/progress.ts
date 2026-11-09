import type { ReceiptStatus } from '@/features/receipts/types'
import { attentionReasons, type LineItem } from '@/features/review/review-logic'
import { ALL_DONE, formatKg, providerLabel, STEP } from './steps'

export type Summary = {
  count: number
  withCo2e: number
  totalKg: number
  attention: number
  learned: number
  estimated: number
}

export function summarize(items: readonly LineItem[]): Summary {
  return {
    count: items.length,
    withCo2e: items.filter((item) => item.co2e_kg !== null).length,
    totalKg: items.reduce((sum, item) => sum + (item.co2e_kg ?? 0), 0),
    attention: items.filter((item) => attentionReasons(item).length > 0).length,
    learned: items.filter((item) => item.quantity_source === 'learned').length,
    estimated: items.filter((item) => item.quantity_source === 'estimated').length,
  }
}

export type LogTone = 'neutral' | 'ok' | 'warn' | 'danger'
export type LogEntry = { at: number; text: string; tone: LogTone }
export type Visit = { step: number; at: number }
export type ProviderVisit = { name: string; at: number }

type LogInput = {
  /** Shown steps with the time they became active (ms since the view opened). */
  visits: readonly Visit[]
  /** LLM providers in the order they were used. */
  providers: readonly ProviderVisit[]
  status: ReceiptStatus
  error: string | null
  failedAt: number | null
  fromUpload: boolean
  summary: Summary | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The protocol shown next to the steps – derived, so it is the same on every render. */
export function buildLog(input: LogInput): LogEntry[] {
  const { visits, providers, summary } = input
  const entries: LogEntry[] = []
  const first = visits[0]
  if (first) {
    entries.push(
      input.fromUpload
        ? { at: first.at, text: 'Upload gestartet', tone: 'neutral' }
        : { at: first.at, text: 'Live-Ansicht geöffnet', tone: 'neutral' },
    )
  }

  for (const visit of visits.slice(1)) {
    const { at } = visit
    switch (visit.step) {
      case STEP.read:
        entries.push({ at, text: 'Foto liegt im privaten Speicher', tone: 'ok' })
        if (input.status === 'pending' && providers.length === 0)
          entries.push({ at, text: 'Wartet auf den Start der Analyse', tone: 'neutral' })
        break
      case STEP.validate:
        entries.push({ at, text: 'Antwort entspricht dem Schema', tone: 'ok' })
        break
      case STEP.match:
        if (summary) {
          entries.push({
            at,
            text: `${plural(summary.count, 'Position', 'Positionen')} erkannt`,
            tone: 'neutral',
          })
          if (summary.learned > 0)
            entries.push({
              at,
              text: `${summary.learned}× Menge aus deinen Korrekturen`,
              tone: 'neutral',
            })
          if (summary.estimated > 0)
            entries.push({
              at,
              text: `${summary.estimated}× Packungsgröße geschätzt`,
              tone: 'neutral',
            })
        }
        break
      case STEP.calculate:
        entries.push({ at, text: 'Emissionsfaktoren angewendet', tone: 'neutral' })
        break
      case ALL_DONE:
        if (summary) {
          entries.push({ at, text: `Summe: ${formatKg(summary.totalKg)} kg CO₂e`, tone: 'ok' })
          entries.push(
            summary.attention > 0
              ? {
                  at,
                  text: `${plural(summary.attention, 'Position braucht', 'Positionen brauchen')} deinen Blick`,
                  tone: 'warn',
                }
              : { at, text: 'Bereit zur Prüfung', tone: 'ok' },
          )
        }
        break
    }
  }

  const opened = first?.at ?? 0
  providers.forEach((provider, index) => {
    const previous = providers[index - 1]
    const at = Math.max(provider.at, opened)
    entries.push(
      previous
        ? {
            at,
            text: `${providerLabel(previous.name)} nicht verfügbar · Fallback auf ${providerLabel(provider.name)}`,
            tone: 'warn',
          }
        : { at, text: `Anfrage an ${providerLabel(provider.name)}`, tone: 'neutral' },
    )
  })

  if (input.status === 'failed' && input.failedAt !== null) {
    entries.push({
      at: input.failedAt,
      text: input.error ?? 'Analyse fehlgeschlagen',
      tone: 'danger',
    })
  }

  // Stable sort keeps the order above for entries with the same timestamp.
  return entries.toSorted((a, b) => a.at - b.at)
}
