import type { Receipt } from '@/features/receipts/types'
import type { Enums } from '@/types/db-helpers'

export type StepKind = 'KI' | 'Code'

/** The five steps shown to the user. Only reading is done by an AI. */
export const STEPS = [
  { label: 'Hochladen', kind: 'Code', activity: 'Foto wird hochgeladen' },
  { label: 'Lesen', kind: 'KI', activity: 'Die KI liest deinen Bon' },
  { label: 'Prüfen', kind: 'Code', activity: 'Ergebnis wird geprüft' },
  { label: 'Zuordnen', kind: 'Code', activity: 'Kategorien & Mengen' },
  { label: 'Berechnen', kind: 'Code', activity: 'CO₂e wird berechnet' },
] as const satisfies readonly { label: string; kind: StepKind; activity: string }[]

/** Index after the last step: everything is done. */
export const ALL_DONE = STEPS.length

export const STEP = { upload: 0, read: 1, validate: 2, match: 3, calculate: 4 } as const

const SERVER_STEP: Record<Enums<'processing_step'>, number> = {
  reading: STEP.read,
  validating: STEP.validate,
  matching: STEP.match,
  calculating: STEP.calculate,
}

/** Where the pipeline is, as reported by the edge function. */
export function serverStepIndex(receipt: Pick<Receipt, 'status' | 'processing_step'>): number {
  if (receipt.status === 'review' || receipt.status === 'done') return ALL_DONE
  if (receipt.status === 'pending' || !receipt.processing_step) return STEP.read
  return SERVER_STEP[receipt.processing_step]
}

/**
 * Line items exist only once the receipt is complete. Until they are loaded the view
 * stays at "Prüfen", so the receipt can be printed step by step afterwards.
 */
export function displayTarget(serverIndex: number, itemsLoaded: boolean): number {
  return serverIndex > STEP.validate && !itemsLoaded ? STEP.validate : serverIndex
}

const PROVIDER_LABEL: Record<string, string> = { gemini: 'Gemini', groq: 'Groq', mock: 'Test-KI' }

export function providerLabel(name: string): string {
  return PROVIDER_LABEL[name] ?? name.charAt(0).toUpperCase() + name.slice(1)
}

/** "00:04.2" */
export function formatClock(ms: number): string {
  const tenths = Math.max(0, Math.floor(ms / 100))
  const seconds = Math.floor(tenths / 10)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${tenths % 10}`
}

/** "3,4 s" */
export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
}

const kgFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Fixed two decimals, so counting numbers do not jump in width. */
export function formatKg(kg: number): string {
  return kgFormatter.format(kg)
}

/** Router state set by the upload, so the live view can show the upload as step one. */
export type LiveViewState = { fromUpload: true }

export function isFromUpload(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'fromUpload' in state &&
    state.fromUpload === true
  )
}
