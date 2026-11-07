/** DB column `co2e_kg` is numeric(12, 4). */
export const CO2E_DECIMALS = 4

/** Multiplies by 10^exponent on the decimal string, e.g. ("12.34565", 4) → 123456.5. */
function shiftDecimal(value: number, exponent: number): number {
  const [mantissa, currentExponent = '0'] = String(value).split('e')
  return Number(`${mantissa}e${Number(currentExponent) + exponent}`)
}

/**
 * Half-up rounding on the decimal representation. Shifting via the exponent
 * avoids binary artefacts: 12.34565 is stored as 12.3456499…, so
 * `Math.round(12.34565 * 1e4)` would round down.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value
  return shiftDecimal(Math.round(shiftDecimal(value, decimals)), -decimals)
}

export function roundCo2e(value: number): number {
  return roundTo(value, CO2E_DECIMALS)
}
