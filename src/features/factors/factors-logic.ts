import { GROUP_LABEL, type EmissionCategory } from '@/features/categories/categories'

export type FactorGroup = { group: string; label: string; factors: EmissionCategory[] }
export type FactorSource = { url: string; name: string; count: number }

const collator = new Intl.Collator('de')

/**
 * Groups the factors in the order of `GROUP_LABEL`; a group the UI does not know yet is
 * appended (never dropped), so the page always shows every factor of the database.
 */
export function groupFactors(factors: readonly EmissionCategory[]): FactorGroup[] {
  const byGroup = new Map<string, EmissionCategory[]>()
  for (const factor of factors) {
    const list = byGroup.get(factor.category_group) ?? []
    list.push(factor)
    byGroup.set(factor.category_group, list)
  }
  const known = Object.keys(GROUP_LABEL)
  const unknown = [...byGroup.keys()].filter((group) => !known.includes(group)).toSorted()
  return [...known, ...unknown]
    .map((group) => ({
      group,
      label: GROUP_LABEL[group] ?? group,
      factors: (byGroup.get(group) ?? []).toSorted((a, b) => collator.compare(a.label, b.label)),
    }))
    .filter((entry) => entry.factors.length > 0)
}

/** Case-insensitive match on name and source text. An empty query matches everything. */
export function filterFactors(
  factors: readonly EmissionCategory[],
  query: string,
): EmissionCategory[] {
  const needle = query.trim().toLocaleLowerCase('de')
  if (!needle) return [...factors]
  return factors.filter((factor) =>
    `${factor.label} ${factor.source}`.toLocaleLowerCase('de').includes(needle),
  )
}

const PUBLISHER: Record<string, string> = {
  'www.ifeu.de':
    'ifeu 2020 – Ökologische Fußabdrücke von Lebensmitteln und Gerichten in Deutschland',
  'www.bafu.admin.ch': 'BAFU – CO₂-Emissionsfaktoren des THG-Inventars der Schweiz (Jan. 2026)',
  'nosgestesclimat.fr': 'Nos Gestes Climat (ADEME) – Fußabdruck von Tierfutter',
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** Distinct sources (by URL) with the number of factors that rely on each, largest first. */
export function summarizeSources(factors: readonly EmissionCategory[]): FactorSource[] {
  const counts = new Map<string, number>()
  for (const factor of factors) {
    if (!factor.source_url) continue
    counts.set(factor.source_url, (counts.get(factor.source_url) ?? 0) + 1)
  }
  return [...counts]
    .map(([url, count]) => ({ url, count, name: PUBLISHER[hostOf(url)] ?? hostOf(url) }))
    .toSorted((a, b) => b.count - a.count || collator.compare(a.name, b.name))
}

const CSV_HEADER = [
  'slug',
  'bezeichnung',
  'gruppe',
  'einheit',
  'kg_co2e_je_einheit',
  'quelle',
  'quelle_url',
]

function csvCell(value: string | number | null) {
  const text = value === null ? '' : String(value)
  return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Complete factor table as CSV (UTF-8, comma-separated, decimal point), one row per factor. */
export function factorsToCsv(factors: readonly EmissionCategory[]): string {
  const rows = groupFactors(factors).flatMap(({ factors: list, label }) =>
    list.map((f) => [f.slug, f.label, label, f.unit, f.co2e_per_unit, f.source, f.source_url]),
  )
  return [CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
