import type { Summary } from './progress'
import { formatKg, STEP, STEPS } from './steps'

export type StoryTag = { text: string; tone?: 'brand' | 'warn' | 'danger' }
export type Story = { title: string; description: string; tags: StoryTag[] }

type StoryInput = {
  step: number
  failed: boolean
  done: boolean
  waiting: boolean
  error: string | null
  summary: Summary | null
  /** Display names of the providers used so far, in order. */
  providers: readonly string[]
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Title, explanation and detail chips for the current state of the analysis. */
export function buildStory(input: StoryInput): Story {
  const { step, summary, providers } = input
  if (input.failed) {
    return {
      title: 'Das hat nicht geklappt',
      description:
        input.error ??
        'Die Analyse ist fehlgeschlagen. Dein Foto ist gespeichert, du kannst es erneut versuchen.',
      tags: [{ text: `Abbruch bei ${STEPS[step]?.label ?? 'Lesen'}`, tone: 'danger' }],
    }
  }
  if (input.done && summary) {
    return {
      title:
        summary.attention === 0
          ? 'Fertig. Alles sieht plausibel aus.'
          : `Fertig. ${plural(summary.attention, 'Position braucht', 'Positionen brauchen')} deinen Blick.`,
      description: `${plural(summary.count, 'Position', 'Positionen')} erkannt, ${summary.withCo2e} davon mit CO₂-Wert. Nur das Lesen war KI, alles andere ist nachvollziehbar berechnet.`,
      tags: [],
    }
  }
  if (input.waiting) {
    return {
      title: 'Wartet auf den Start',
      description: 'Dein Foto ist gespeichert, die Analyse ist aber noch nicht gestartet.',
      tags: [{ text: 'In Warteschlange' }],
    }
  }
  const current = providers.at(-1)
  const fellBack = providers.length > 1
  switch (step) {
    case STEP.upload:
      return {
        title: 'Foto wird hochgeladen',
        description: 'Dein Bon landet in deinem privaten Speicher. Nur du hast Zugriff darauf.',
        tags: [],
      }
    case STEP.read:
      return {
        title: 'Die KI liest deinen Bon',
        description:
          'Händler, Datum und jede Position werden aus dem Foto gelesen. Das ist der einzige Schritt mit KI.',
        tags: current
          ? [
              {
                text: fellBack ? `${current} · Fallback` : current,
                tone: fellBack ? 'warn' : 'brand',
              },
              ...(fellBack ? [{ text: `${providers[0] ?? ''} überlastet` }] : []),
            ]
          : [{ text: 'Verbindet …' }],
      }
    case STEP.validate:
      return {
        title: 'Ergebnis wird geprüft',
        description:
          'Die Antwort muss ein festes Schema erfüllen, bevor sie gespeichert wird. Pfand und Leergut fliegen raus.',
        tags: [],
      }
    case STEP.match:
      return {
        title: 'Kategorien & Mengen',
        description:
          'Deine früheren Korrekturen haben Vorrang vor dem KI-Vorschlag. Fehlende Packungsgrößen werden geschätzt.',
        tags: [
          ...(summary && summary.learned > 0
            ? [{ text: `${summary.learned}× gelernt`, tone: 'brand' as const }]
            : []),
          ...(summary && summary.estimated > 0
            ? [{ text: `${summary.estimated}× geschätzt` }]
            : []),
        ],
      }
    default:
      return {
        title: 'CO₂e wird berechnet',
        description: 'Menge × Emissionsfaktor, jeder Wert mit Quelle. Getesteter Code, keine KI.',
        tags: summary ? [{ text: `${formatKg(summary.totalKg)} kg CO₂e`, tone: 'brand' }] : [],
      }
  }
}
