import type { Receipt } from '@/features/receipts/types'
import type { Enums } from '@/types/db-helpers'

/** The five steps shown to the user, in plain language. */
export const STEPS = [
  {
    label: 'Foto hochladen',
    activity: 'Foto wird hochgeladen',
    hint: 'Dein Bon wird in deinem privaten Speicher abgelegt. Nur du hast Zugriff darauf.',
  },
  {
    label: 'Bon lesen',
    activity: 'Bon wird gelesen',
    hint: 'Händler, Datum und alle Positionen werden vom Foto gelesen. Das dauert meist 10 bis 30 Sekunden.',
  },
  {
    label: 'Angaben prüfen',
    activity: 'Angaben werden geprüft',
    hint: 'Wir prüfen, ob alles vollständig ist. Pfand und Leergut werden aussortiert.',
  },
  {
    label: 'Produkte zuordnen',
    activity: 'Produkte werden zugeordnet',
    hint: 'Jedes Produkt bekommt eine Kategorie. Deine früheren Korrekturen haben Vorrang.',
  },
  {
    label: 'CO₂ berechnen',
    activity: 'CO₂ wird berechnet',
    hint: 'Für jedes Produkt wird der CO₂-Fußabdruck berechnet, jeder Wert mit Quelle.',
  },
] as const satisfies readonly { label: string; activity: string; hint: string }[]

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

const kgFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Fixed two decimals, so counting numbers do not jump in width. */
export function formatKg(kg: number): string {
  return kgFormatter.format(kg)
}

/** Router state set by the upload, so the progress dialog can show the upload as step one. */
export type LiveViewState = { fromUpload: true }

export function isFromUpload(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'fromUpload' in state &&
    state.fromUpload === true
  )
}
