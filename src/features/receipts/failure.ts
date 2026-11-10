/** What to tell a user whose receipt could not be analysed – and what they can do next. */
export type FailureHelp = {
  title: string
  tips: string[]
  /** Another try with the same photo can work (a hiccup, not the photo). */
  canRetry: boolean
  /** A different photo is the way forward. */
  canUploadNew: boolean
}

const FAILURE_HELP: Record<string, FailureHelp> = {
  not_a_receipt: {
    title: 'Das ist kein Kassenbon',
    tips: [
      'Fotografiere den Kassenbon oder die Quittung selbst, nicht einen Bildschirm oder ein anderes Dokument.',
      'Der Bon sollte das Bild füllen und gerade im Bild liegen.',
    ],
    canRetry: false,
    canUploadNew: true,
  },
  unreadable: {
    title: 'Der Bon ist schwer zu lesen',
    tips: [
      'Lege den Bon flach auf einen hellen, matten Untergrund und streiche ihn glatt.',
      'Fotografiere bei gutem Licht, ohne Blitz und ohne Spiegelung.',
      'Halte die Kamera ruhig und senkrecht über den Bon, bis der Text scharf ist.',
    ],
    canRetry: false,
    canUploadNew: true,
  },
  cut_off: {
    title: 'Der Bon ist abgeschnitten',
    tips: [
      'Achte darauf, dass der Bon von oben bis unten im Bild ist.',
      'Ist er sehr lang, fotografiere ihn in zwei Teilen ohne Überlappung und lade beide als eigene Belege hoch.',
    ],
    canRetry: false,
    canUploadNew: true,
  },
  no_items: {
    title: 'Keine Positionen gefunden',
    tips: [
      'Prüfe, ob auf dem Foto die Artikelzeilen zu sehen sind und nicht nur Summe oder Kartenzahlung.',
      'Ein Kassenbon aus dem Supermarkt funktioniert am besten. Reine Pfand- oder Rabattbons enthalten nichts zu berechnen.',
    ],
    canRetry: false,
    canUploadNew: true,
  },
  quota: {
    title: 'Tageslimit erreicht',
    tips: [
      'Das Limit schützt die kostenlosen KI-Dienste. Morgen kannst du wieder Belege analysieren lassen.',
    ],
    canRetry: false,
    canUploadNew: false,
  },
  ai_unavailable: {
    title: 'Die KI ist gerade nicht erreichbar',
    tips: ['Das liegt nicht an deinem Foto. Versuche es in ein paar Minuten noch einmal.'],
    canRetry: true,
    canUploadNew: false,
  },
  no_file: {
    title: 'Zu diesem Beleg fehlt das Foto',
    tips: ['Lade den Bon bitte noch einmal hoch.'],
    canRetry: false,
    canUploadNew: true,
  },
}

const UNKNOWN: FailureHelp = {
  title: 'Das hat leider nicht geklappt',
  tips: ['Dein Foto ist gespeichert. Ein erneuter Versuch hilft oft.'],
  canRetry: true,
  canUploadNew: false,
}

/** Unknown or missing codes (receipts from before the codes existed) get the generic help. */
export function failureHelp(code: string | null | undefined): FailureHelp {
  return (code ? FAILURE_HELP[code] : undefined) ?? UNKNOWN
}

export type NoteHelp = { title: string; text: string }

const NOTE_HELP: Record<string, NoteHelp> = {
  cut_off: {
    title: 'Der Bon wirkt abgeschnitten',
    text: 'Positionen am Rand können fehlen. Fehlt etwas, lade den Rest als eigenen Beleg hoch.',
  },
  unreadable: {
    title: 'Teile des Bons waren schwer lesbar',
    text: 'Schau dir die markierten Positionen besonders genau an. Ein schärferes Foto liefert bessere Ergebnisse.',
  },
  multiple_receipts: {
    title: 'Mehrere Bons auf dem Foto',
    text: 'Gelesen wurde nur einer davon. Lade die anderen als eigene Belege hoch.',
  },
  foreign_currency: {
    title: 'Der Bon ist nicht in Euro',
    text: 'Die Preise wurden nicht übernommen. Für den CO₂-Wert zählen nur die Mengen.',
  },
  non_food_only: {
    title: 'Keine Lebensmittel erkannt',
    text: 'Ohne passende Kategorie gibt es keinen CO₂-Wert. Passt doch etwas, wähle die Kategorie selbst.',
  },
}

/** Notes unknown to this version are skipped instead of shown as raw codes. */
export function noteHelp(notes: readonly string[]): NoteHelp[] {
  return notes.flatMap((note) => NOTE_HELP[note] ?? [])
}
