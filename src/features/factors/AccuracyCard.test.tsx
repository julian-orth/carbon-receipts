import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AccuracyReport } from './accuracy'
import { AccuracyCard } from './AccuracyCard'

const report: AccuracyReport = {
  receipts: 14,
  measuredOn: '2026-12-01',
  metrics: [
    { id: 'items', label: 'Positionen erkannt', description: 'd1', value: 0.94 },
    { id: 'category', label: 'Kategorie stimmt', description: 'd2', value: null },
  ],
}

describe('AccuracyCard', () => {
  it('says plainly that nothing is measured yet', () => {
    render(<AccuracyCard />)
    expect(screen.getByText(/Messung an echten Belegen steht noch aus/)).toBeInTheDocument()
    expect(screen.getAllByText('noch nicht gemessen')).toHaveLength(4)
    expect(screen.queryByText(/^\d+\s*%$/)).toBeNull()
  })

  it('shows measured values with the size and date of the test set', () => {
    render(<AccuracyCard report={report} />)
    expect(
      screen.getByText('Von Hand geprüft an 14 echten Belegen (Stand 01.12.2026).'),
    ).toBeVisible()
    const items = screen.getByText('Positionen erkannt').closest('div')
    expect(items && within(items).getByText(/94/)).toBeVisible()
    // A metric without a value stays honest next to measured ones.
    expect(screen.getAllByText('noch nicht gemessen')).toHaveLength(1)
  })
})
