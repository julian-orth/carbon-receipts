/**
 * Pacing of the progress dialog. Server steps after the AI call take milliseconds; every
 * step stays visible at least this long so the user can follow what happened.
 * (Tests mock this module to run without waiting.)
 */
export const MIN_STEP_MS = 650

/** Duration of number count-ups on the receipt (CO₂e per line and total). */
export const COUNT_UP_MS = 900

/** How long the fill of a running step takes to creep towards 90 %. Reading is the slow one. */
export const CREEP_MS = [1500, 14_000, 1500, 1500, 1500] as const

/**
 * Printing the recognised lines: one after another at a readable pace, but a long receipt
 * must not take forever – the gap shrinks so all lines fit into the budget.
 */
export const PRINT_BUDGET_MS = 3600
export const PRINT_MAX_GAP_MS = 260
