/**
 * Details the operator has to fill in before the site goes public (Impressum, privacy notice).
 * `null` renders as a visible placeholder on the page – nothing here is invented.
 * Checklist: docs/deploy.md.
 */
export type LegalConfig = {
  name: string | null
  street: string | null
  city: string | null
  email: string | null
  phone: string | null
  /** Region of the Supabase project, e.g. "Frankfurt (EU)". */
  hostingRegion: string | null
}

export const LEGAL: LegalConfig = {
  name: null,
  street: null,
  city: null,
  email: null,
  phone: null,
  hostingRegion: null,
}

/** Fields still empty – used for the warning on the legal pages. */
export function missingLegalFields(config: LegalConfig, required: (keyof LegalConfig)[]) {
  return required.filter((key) => !config[key]?.trim())
}
