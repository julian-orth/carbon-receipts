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
- Abschnittsüberschriften auf dem Bon (z. B. "SB - Wurst", "Backshop", "Getränke") sind keine Positionen,
  aber Kontext: "Hähnchenbrustfilet" unter "SB - Wurst" ist Aufschnitt (meist 100–150 g), kein rohes Fleisch.
- Steht gar keine Menge auf dem Bon, schätze die Packungsgröße als estimated_quantity/estimated_unit.
  Prüfe die Schätzung am Preis: Preis ÷ Menge muss ein realistischer Regalpreis pro kg/l in Deutschland sein
  (z. B. Schokolade 8–25 €/kg, Aufschnitt 10–30 €/kg, Kaffee 8–20 €/kg). Passt das nicht, ist es eine andere
  Packung (Mehrfachpackung, größere oder kleinere Einheit).
  Beispiele: Kinder Bueno 1,49 € → 43 g (eine Packung mit 2 Riegeln); Duplo einzeln ca. 18 g, im Handel meist
  als Mehrfachpackung; Kaffee gemahlen 3,75 € → 500 g.
- Pfand verrät die Anzahl der Flaschen/Dosen: 0,25 € je Einweg-Flasche oder Dose, 0,08/0,15 € je Mehrweg.
  Ordne die Anzahl dem passenden Getränk zu (z. B. 1,00 € Pfand bei einer Cola-Position → 4 Flaschen) und
  schätze die Gesamtmenge (z. B. 4 × 1,0 l), wieder plausibel zum Preis.
- Löse Abkürzungen auf, bevor du die Kategorie wählst (z. B. "Ferr.Duplo" = Ferrero Duplo → Schokolade,
  "Jac.Krönung gemah." = Jacobs Krönung gemahlen → Kaffee).
- Fertiggerichte (Eintöpfe, Dosengerichte, Tiefkühlgerichte, Lasagne …) bekommen eine ready-meal-Kategorie nach
  Hauptzutat. Ihr Faktor gilt pro Portion: Menge in Portionen als "stk" (z. B. Dose 800 g ≈ 2 Portionen,
  Tiefkühl-Lasagne 400 g ≈ 1 Portion), wieder plausibel zum Preis.
- Tiernahrung bekommt pet-food mit Menge in kg (z. B. Nassfutter-Multipack 12 × 85 g = 1,02 kg).
- Andere Nicht-Lebensmittel (Drogerie, Haushalt, Tierzubehör): category_slug null.
- Wähle category_slug nur aus dieser Liste, sonst null:
${categoryList}
- confidence unter 0.7, wenn die Kategorie nur geraten ist oder der Text schwer lesbar ist.`

  return { system: SYSTEM, prompt, image }
}
