import type { Summary } from './progress'
import { STEPS } from './steps'

export type Story = { title: string; description: string }

type StoryInput = {
  step: number
  failed: boolean
  done: boolean
  waiting: boolean
  error: string | null
  summary: Summary | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Headline and one explaining sentence for the current state of the analysis. */
export function buildStory(input: StoryInput): Story {
  const { summary } = input
  if (input.failed) {
    return {
      title: 'Das hat leider nicht geklappt',
      description:
        input.error ??
        'Die Analyse ist fehlgeschlagen. Dein Foto ist gespeichert, du kannst es erneut versuchen.',
    }
  }
  if (input.done && summary) {
    return summary.attention === 0
      ? {
          title: 'Fertig! Alles sieht plausibel aus.',
          description: `${plural(summary.count, 'Position', 'Positionen')} erkannt. Schau trotzdem kurz drüber, dann zählt der Beleg in deiner Übersicht.`,
        }
      : {
          title: `Fertig! ${plural(summary.attention, 'Position braucht', 'Positionen brauchen')} deinen Blick.`,
          description: `${plural(summary.count, 'Position', 'Positionen')} erkannt. Die markierten Zeilen konnten nicht sicher zugeordnet werden – ein kurzer Blick genügt.`,
        }
  }
  if (input.waiting) {
    return {
      title: 'Wartet auf den Start',
      description: 'Dein Foto ist gespeichert, die Analyse ist aber noch nicht gestartet.',
    }
  }
  return {
    title: `${STEPS[input.step]?.activity ?? 'Bon wird gelesen'} …`,
    description: 'Du kannst zusehen oder das Fenster schließen – die Analyse läuft weiter.',
  }
}
