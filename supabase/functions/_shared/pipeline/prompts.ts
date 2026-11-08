import type { LlmRequest } from '../llm/types.ts'

export type PromptCategory = { slug: string; label: string; unit: string }

const SYSTEM = `Du extrahierst Positionen aus Fotos deutscher Kassenbons.
Antworte ausschließlich mit JSON. Erfinde keine Positionen, die nicht auf dem Bon stehen.`

/**
 * The model only extracts and suggests a category. It never computes CO2e –
 * that happens deterministically in code.
 */
export function buildExtractionRequest(
  categories: readonly PromptCategory[],
  image: NonNullable<LlmRequest['image']>,
): LlmRequest {
  const categoryList = categories.map((c) => `- ${c.slug}: ${c.label} (pro ${c.unit})`).join('\n')

  const prompt = `Lies den Kassenbon auf dem Bild und gib folgendes JSON zurück:

{
  "merchant": string | null,          // Name des Geschäfts
  "purchased_at": "YYYY-MM-DD" | null, // Kaufdatum
  "items": [
    {
      "raw_text": string,           // nur die Artikelzeile wie auf dem Bon, ohne Mengen-/Gewichtszeilen
      "quantity": number | null,    // nur wenn auf dem Bon: z. B. 0.512 bei "0,512 kg x 1,99 €/kg", 2 bei "2 x"
      "unit": "kg" | "g" | "l" | "ml" | "stk" | null,
      "estimated_quantity": number | null, // übliche Packungsgröße, wenn auf dem Bon keine Menge steht
      "estimated_unit": "kg" | "g" | "l" | "ml" | "stk" | null,
      "price": number | null,       // Gesamtpreis der Zeile in EUR
      "category_slug": string | null,
      "confidence": number          // 0 bis 1: wie sicher die Kategorie passt
    }
  ]
}

Regeln:
- Ignoriere Summen, Zwischensummen, MwSt., Zahlungsart, Rückgeld, Pfand, Leergut und Rabatte.
- Mengen- und Gewichtszeilen ohne eigenen Artikelnamen (z. B. "2 x 0,89" oder "1,186 kg x 1,41 EUR/kg")
  gehören zu genau einer Position. Ordne sie der Position zu, deren Preis Menge × Einzelpreis ergibt,
  und trage die Menge in quantity/unit ein – nicht in raw_text.
- Wenn die Menge nur im Produktnamen steht (z. B. "Milch 1L"), lass quantity und unit leer.
- Steht gar keine Menge auf dem Bon, schätze die übliche Packungsgröße des Produkts in Deutschland
  als estimated_quantity/estimated_unit (z. B. Kinder Bueno 43 g, Kaffee gemahlen 500 g, Quark 250 g).
  Nutze Preis und Pfand als Hinweis (Getränk mit 0,25 € Pfand: Einwegflasche, oft 1,5 l). Gewichtsware
  (Fleisch, Käse an der Theke, Obst lose) ohne Gewichtsangabe: nur schätzen, wenn der Preis es nahelegt.
- Löse Abkürzungen auf, bevor du die Kategorie wählst (z. B. "Ferr.Duplo" = Ferrero Duplo → Schokolade,
  "Jac.Krönung gemah." = Jacobs Krönung gemahlen → Kaffee).
- Nicht-Lebensmittel (Tierbedarf, Drogerie, Haushalt) und Fertiggerichte ohne passende Kategorie: category_slug null.
- Wähle category_slug nur aus dieser Liste, sonst null:
${categoryList}
- confidence unter 0.7, wenn die Kategorie nur geraten ist oder der Text schwer lesbar ist.`

  return { system: SYSTEM, prompt, image }
}
