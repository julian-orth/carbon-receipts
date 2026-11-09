export const receiptKeys = {
  all: ['receipts'] as const,
  list: () => [...receiptKeys.all, 'list'] as const,
  totals: () => [...receiptKeys.all, 'totals'] as const,
}
