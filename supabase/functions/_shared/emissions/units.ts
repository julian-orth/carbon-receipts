import { roundTo } from './round.ts'
import type { EmissionUnit } from './types.ts'

type UnitConversion = { unit: EmissionUnit; factor: number }

/** Raw unit spellings found on German receipts → canonical unit + multiplier. */
const UNIT_ALIASES: Record<string, UnitConversion> = {
  kg: { unit: 'kg', factor: 1 },
  kilo: { unit: 'kg', factor: 1 },
  g: { unit: 'kg', factor: 0.001 },
  gr: { unit: 'kg', factor: 0.001 },
  gramm: { unit: 'kg', factor: 0.001 },
  l: { unit: 'l', factor: 1 },
  ltr: { unit: 'l', factor: 1 },
  liter: { unit: 'l', factor: 1 },
  ml: { unit: 'l', factor: 0.001 },
  cl: { unit: 'l', factor: 0.01 },
  stk: { unit: 'piece', factor: 1 },
  st: { unit: 'piece', factor: 1 },
  stück: { unit: 'piece', factor: 1 },
  x: { unit: 'piece', factor: 1 },
  pcs: { unit: 'piece', factor: 1 },
  piece: { unit: 'piece', factor: 1 },
  eur: { unit: 'eur', factor: 1 },
  '€': { unit: 'eur', factor: 1 },
}

/** Parses German and English number notation: "1,5", "1.5", "1.000,5". */
export function parseDecimal(raw: string): number | null {
  const value = raw.trim()
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+([.,]\d+)?$/.test(value)) return null
  const normalized = value.includes(',') ? value.replaceAll('.', '').replace(',', '.') : value
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

/**
 * Converts a quantity in any supported unit to the canonical unit.
 * Returns null for unknown units or non-positive quantities.
 */
export function normalizeQuantity(
  quantity: number,
  rawUnit: string,
): { quantity: number; unit: EmissionUnit } | null {
  const conversion = UNIT_ALIASES[rawUnit.trim().toLowerCase().replace(/\.$/, '')]
  if (!conversion || !Number.isFinite(quantity) || quantity <= 0) return null
  // 43 g × 0.001 = 0.043000000000000003 – round away binary noise (6 places ≥ DB precision)
  return { quantity: roundTo(quantity * conversion.factor, 6), unit: conversion.unit }
}

/**
 * Extracts a pack size such as "500g", "1,5 l" or "6x0,33l" from a product name.
 * Multi-packs are multiplied out.
 */
export function parsePackSize(text: string): { quantity: number; unit: EmissionUnit } | null {
  const pattern = /(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|cl|l|ltr)(?![a-zäöüß])/i
  const match = pattern.exec(text)
  if (!match) return null
  const [, count, amount, unit] = match
  const value = amount === undefined ? null : parseDecimal(amount)
  if (value === null || unit === undefined) return null
  const multiplier = count === undefined ? 1 : Number(count)
  return normalizeQuantity(value * multiplier, unit)
}
