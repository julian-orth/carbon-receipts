import type { EmissionCategory } from './categories'
import { GROUP_LABEL } from './categories'

type Searchable = Pick<EmissionCategory, 'id' | 'slug' | 'label' | 'category_group'>

/** Everyday words on German receipts that do not appear in the category labels. */
const KEYWORDS: Record<string, readonly string[]> = {
  cheese: ['gouda', 'emmentaler', 'mozzarella', 'parmesan', 'feta', 'camembert', 'brie', 'edamer'],
  chicken: ['hähnchen', 'hühnchen', 'huhn', 'pute', 'puten', 'chicken'],
  pork: ['schwein', 'schnitzel', 'kotelett', 'bauch', 'nacken'],
  beef: ['rind', 'steak', 'rumpsteak', 'gulasch'],
  'ground-beef': ['hack', 'gehacktes'],
  'beef-cold-cuts': ['aufschnitt', 'roastbeef', 'bresaola'],
  sausage: ['salami', 'schinken', 'würstchen', 'bratwurst', 'wiener', 'leberwurst', 'mortadella'],
  milk: ['vollmilch', 'h-milch', 'frischmilch', 'weidemilch'],
  yogurt: ['joghurt', 'skyr', 'jogurt'],
  cream: ['schlagsahne', 'schmand', 'crème', 'creme fraiche'],
  'cream-cheese': ['philadelphia', 'hüttenkäse', 'ricotta', 'mascarpone'],
  eggs: ['ei', 'freiland', 'bodenhaltung'],
  bread: ['vollkorn', 'roggen', 'sauerteig', 'toast'],
  'bread-rolls': ['semmel', 'brezel', 'baguette', 'weck'],
  oats: ['müsli', 'muesli', 'granola', 'cornflakes'],
  pasta: ['spaghetti', 'penne', 'fusilli', 'tagliatelle', 'lasagneplatten', 'gnocchi'],
  rice: ['basmati', 'jasmin', 'risotto'],
  potatoes: ['kartoffel', 'drillinge'],
  onions: ['zwiebel', 'lauch', 'porree', 'knoblauch', 'schalotte'],
  peppers: ['paprika', 'chili', 'peperoni'],
  citrus: ['zitrone', 'limette', 'mandarine', 'clementine', 'grapefruit'],
  berries: ['erdbeere', 'himbeere', 'heidelbeere', 'blaubeere', 'johannisbeere'],
  tomatoes: ['tomate', 'rispentomate', 'cherrytomate'],
  'tomato-products': ['passata', 'tomatenmark', 'pizzatomaten'],
  salad: ['eisberg', 'rucola', 'feldsalat', 'kopfsalat', 'spinat'],
  cabbage: ['weißkohl', 'rotkohl', 'wirsing', 'kohlrabi', 'sauerkraut'],
  zucchini: ['kürbis', 'hokkaido', 'aubergine'],
  mushrooms: ['champignon', 'pilz', 'pfifferling'],
  apples: ['apfel', 'elstar', 'braeburn', 'pink lady'],
  'soft-drinks': ['cola', 'fanta', 'sprite', 'limo', 'eistee', 'energy', 'mate'],
  'mineral-water': ['wasser', 'sprudel', 'medium', 'still'],
  'apple-juice': ['saft', 'schorle', 'nektar'],
  beer: ['pils', 'helles', 'weizen', 'radler', 'lager'],
  wine: ['riesling', 'rotwein', 'weißwein', 'rosé', 'sekt', 'prosecco'],
  coffee: ['espresso', 'kaffeebohnen', 'crema'],
  chocolate: ['schoko', 'praline', 'riegel', 'nutella'],
  pastries: ['kuchen', 'keks', 'croissant', 'muffin', 'plunder', 'gebäck'],
  'oat-drink': ['hafer', 'barista', 'oatly'],
  'soy-drink': ['soja', 'alpro'],
  tofu: ['tempeh', 'seitan'],
  legumes: ['linsen', 'bohnen', 'kichererbsen', 'erbsen'],
  nuts: ['mandel', 'cashew', 'walnuss', 'haselnuss', 'erdnuss', 'pistazie'],
  'fish-farmed': ['lachs', 'forelle', 'dorade', 'pangasius'],
  'fish-wild': ['kabeljau', 'seelachs', 'hering', 'thunfisch', 'makrele', 'scholle'],
  'fish-frozen': ['fischstäbchen', 'schlemmerfilet'],
  shrimp: ['garnele', 'scampi', 'krabben'],
  'pet-food': ['katzenfutter', 'hundefutter', 'whiskas', 'felix', 'sheba'],
  petrol: ['super', 'e10', 'e5', 'benzin'],
  diesel: ['diesel'],
}

/** Lower case without diacritics: "Käse" and "kase" match. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
}

function words(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length >= 2)
}

function keywordsOf(category: Searchable): string[] {
  return [
    ...words(category.label),
    ...(KEYWORDS[category.slug] ?? []).map(normalize),
    ...words(GROUP_LABEL[category.category_group] ?? ''),
  ]
}

/**
 * Typed search: exact label prefix beats plain label prefix beats word prefix beats substring beats keyword/group hit.
 * Returns categories in rank order, an empty query returns them unchanged.
 */
export function searchCategories<T extends Searchable>(categories: readonly T[], query: string) {
  const typed = query.trim().toLowerCase()
  const needle = normalize(typed)
  if (needle === '') return [...categories]
  const scored: { category: T; score: number }[] = []
  for (const category of categories) {
    const label = normalize(category.label)
    let score = 0
    // Typed with umlaut ("kä") is more specific than its plain form: Käse before Kaffee.
    if (category.label.toLowerCase().startsWith(typed)) score = 5
    else if (label.startsWith(needle)) score = 4
    else if (words(category.label).some((word) => word.startsWith(needle))) score = 3
    else if (label.includes(needle)) score = 2
    else if (keywordsOf(category).some((word) => word.startsWith(needle))) score = 1
    if (score > 0) scored.push({ category, score })
  }
  // Stable: equal scores keep the incoming (alphabetical) order.
  return scored.toSorted((a, b) => b.score - a.score).map((entry) => entry.category)
}

/** A receipt word fits a keyword when it is, contains or starts a longer keyword. */
function fits(word: string, keyword: string): boolean {
  if (keyword.length < 3) return false
  if (word === keyword) return true
  // German compounds: "bergkase" ends with "kase", "schokoriegel" starts with "schoko".
  // Not anywhere inside, or "tomaten" would match "mate".
  if (keyword.length >= 4 && (word.endsWith(keyword) || word.startsWith(keyword))) return true
  // "hafer" starts "haferdrink"
  return word.length >= 4 && keyword.startsWith(word)
}

/**
 * Categories that fit the receipt text ("Bergkäse am Stück" → Käse), current choice
 * first. Matches whole receipt words against label words and keywords, so short
 * fragments ("am") never match.
 */
export function suggestCategories<T extends Searchable>(
  categories: readonly T[],
  receiptText: string,
  currentId: string | null,
  limit = 4,
): T[] {
  const receiptWords = words(receiptText).filter((word) => word.length >= 3)
  const matches = categories.filter(
    (category) =>
      category.id !== currentId &&
      receiptWords.some((word) =>
        [...words(category.label), ...(KEYWORDS[category.slug] ?? []).map(normalize)].some(
          (keyword) => fits(word, keyword),
        ),
      ),
  )
  const current = categories.find((category) => category.id === currentId)
  return [...(current ? [current] : []), ...matches].slice(0, limit)
}
