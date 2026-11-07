/**
 * Normalizes a receipt line to the key used in `category_mappings`.
 * Goal: different spellings of the same product map to the same key, e.g.
 * "BIO VOLLMILCH 3,8% 1L" and "Bio Vollmilch 3.8 % 1 l" → "bio vollmilch".
 *
 * Must satisfy the DB check `normalized_name = lower(trim(normalized_name))`.
 */
export function normalizeProductName(raw: string): string {
  return (
    raw
      .normalize('NFC')
      .toLowerCase()
      // pack sizes and multi-packs: "500g", "1,5 l", "6x0,33l"
      .replace(/(\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(kg|g|gr|ml|cl|l|ltr|stk|st)(?![a-zäöüß])/g, ' ')
      // percentages: "3,8%", "40 % fett"
      .replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')
      // prices and remaining numbers
      .replace(/\d+(?:[.,]\d+)?/g, ' ')
      // everything that is not a letter (incl. umlauts) or a space
      .replace(/[^a-zäöüß\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}
