import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmissionCategory } from '@/features/categories/categories'
import * as categoriesApi from '@/features/categories/api'
import * as receiptsApi from '@/features/receipts/api'
import { receiptFixture } from '@/features/receipts/test-fixtures'
import { authenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import * as api from './api'
import { DashboardPage } from './DashboardPage'

vi.mock('./api')
vi.mock('@/features/categories/api')
vi.mock('@/features/receipts/api')

const mockedApi = vi.mocked(api)
const today = new Date(2026, 10, 7) // 7 Nov 2026

const factor = (slug: string, label: string, co2e: number, group: string): EmissionCategory => ({
  id: slug,
  slug,
  label,
  unit: 'kg',
  co2e_per_unit: co2e,
  category_group: group,
  source: `ifeu ${slug}`,
  source_url: 'https://example.com/ifeu.pdf',
})

/** A key figure: label (dt) and value (dd) share a parent. */
function figure(label: string) {
  return screen.getByText(label).parentElement
}

function renderDashboard() {
  return renderRoutes([{ path: '/', element: <DashboardPage today={today} /> }], {
    auth: authenticated,
  })
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue([
      factor('ground-beef', 'Rinderhackfleisch', 9.2, 'meat_fish'),
      factor('veggie-patty', 'Veggie-Burger & Bratlinge', 1.1, 'plant_protein'),
    ])
    mockedApi.fetchMonthlyTotals.mockResolvedValue([
      { month: '2026-09-01', total_co2e_kg: 20 },
      { month: '2026-10-01', total_co2e_kg: 15 },
      { month: '2026-11-01', total_co2e_kg: 5 },
    ])
    mockedApi.fetchGroupTotals.mockResolvedValue([
      { month: '2026-10-01', category_group: 'meat_fish', sum_co2e_kg: 27 },
      { month: '2026-11-01', category_group: 'dairy_eggs', sum_co2e_kg: 8 },
    ])
    mockedApi.fetchHotspots.mockResolvedValue([
      {
        id: 'h1',
        raw_text: 'Rinderhack 500g',
        quantity: 0.5,
        unit: 'kg',
        co2e_kg: 4.6,
        category_slug: 'ground-beef',
        category_label: 'Rinderhackfleisch',
        purchased_on: '2026-11-02',
      },
    ])
    mockedApi.fetchMonthlyGoal.mockResolvedValue({ id: 'g1', target_co2e_kg: 50 })
    mockedApi.saveMonthlyGoal.mockResolvedValue()
    vi.mocked(receiptsApi.fetchReceipts).mockResolvedValue([
      receiptFixture({ id: 'r1', status: 'done', purchased_at: '2026-10-12' }),
      receiptFixture({ id: 'r2', status: 'done', purchased_at: '2026-11-02' }),
      receiptFixture({ id: 'r3', status: 'review', purchased_at: '2026-11-05' }),
    ])
    vi.mocked(receiptsApi.fetchReceiptTotals).mockResolvedValue(
      new Map([
        ['r1', { itemCount: 6, co2eKg: 15 }],
        ['r2', { itemCount: 4, co2eKg: 5 }],
      ]),
    )
  })

  it('loads the default range of 6 months', async () => {
    renderDashboard()
    expect(screen.getByRole('status', { name: 'Übersicht wird geladen' })).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Verlauf' })
    // Monthly figures are loaded for 12 months once; the 6-month view is a slice of them.
    expect(mockedApi.fetchMonthlyTotals).toHaveBeenCalledWith('2025-12-01')
    expect(mockedApi.fetchHotspots).toHaveBeenCalledWith('2026-06-01')
    expect(screen.getByRole('button', { name: '6 Monate' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows key figures, the trend as a table, hotspots and a traceable alternative', async () => {
    renderDashboard()

    const hero = await screen.findByRole('region', { name: /laufender Monat/ })
    expect(hero).toHaveTextContent(/November 2026.*5\s?kg CO₂e/)
    // 7 Nov is day 7: 5 kg / 7 days × 30 days
    expect(hero).toHaveTextContent('Hochrechnung bis Monatsende:≈ 21,43 kg CO₂e')
    expect(hero).toHaveTextContent(/Okt\. 26\):15 kg CO₂e.*[-−]25\s%/)

    expect(figure('Summe, 6 Monate')).toHaveTextContent('40 kg CO₂e')
    expect(figure('Bestätigte Belege')).toHaveTextContent('2')
    expect(figure('Ø pro Einkauf')).toHaveTextContent('10 kg CO₂e')
    expect(figure('Erfasste Produkte')).toHaveTextContent('10')
    expect(screen.getByRole('link', { name: /1 Beleg wartet auf dich/ })).toHaveAttribute(
      'href',
      '/receipts/r3',
    )

    const trend = screen.getByRole('region', { name: 'Verlauf' })
    const table = within(trend).getByRole('table', { name: 'CO₂e pro Monat' })
    expect(within(table).getAllByRole('row')).toHaveLength(7) // header + 6 months
    expect(within(table).getByRole('row', { name: 'Okt. 26 15 kg CO₂e' })).toBeInTheDocument()

    const hotspots = screen.getByRole('region', { name: 'Hotspots' })
    expect(within(hotspots).getByText('Rinderhack 500g')).toBeInTheDocument()

    const alternatives = screen.getByRole('region', { name: 'Sparpotenzial' })
    expect(alternatives).toHaveTextContent('Rinderhackfleisch')
    expect(alternatives).toHaveTextContent('Veggie-Burger & Bratlinge')
    expect(alternatives).toHaveTextContent('−4,05 kg CO₂e')
    expect(
      within(alternatives).getByRole('link', { name: 'ifeu veggie-patty' }),
    ).toBeInTheDocument()
  })

  it('shows goal progress with a text status, not just colour', async () => {
    renderDashboard()
    const goal = await screen.findByRole('region', { name: 'Monatsziel' })
    expect(within(goal).getByText('Im Plan')).toBeInTheDocument()
    expect(within(goal).getByText('10 %')).toBeInTheDocument()
    expect(within(goal).getByText('Noch 45 kg CO₂e bis zum Ziel.')).toBeInTheDocument()
  })

  it('switches the range without a loading state or a refetch of the monthly figures', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByRole('region', { name: 'Verlauf' })
    expect(figure('Summe, 6 Monate')).toHaveTextContent('40 kg CO₂e')

    await user.click(screen.getByRole('button', { name: '3 Monate' }))

    // Sliced locally: new figures right away, never the skeleton.
    expect(screen.queryByRole('status', { name: 'Übersicht wird geladen' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 Monate' })).toHaveAttribute('aria-pressed', 'true')
    expect(figure('Summe, 3 Monate')).toBeInTheDocument()
    expect(mockedApi.fetchMonthlyTotals).toHaveBeenCalledTimes(1)
    expect(mockedApi.fetchGroupTotals).toHaveBeenCalledTimes(1)
    // Only the hotspots depend on the range, and they keep the old list while loading.
    await waitFor(() => expect(mockedApi.fetchHotspots).toHaveBeenCalledWith('2026-09-01'))
  })

  it('keeps the running month and the goal hint independent of the range', async () => {
    const user = userEvent.setup()
    renderDashboard()
    const goal = await screen.findByRole('region', { name: 'Monatsziel' })
    const before = goal.textContent

    await user.click(screen.getByRole('button', { name: '12 Monate' }))
    await user.click(screen.getByRole('button', { name: '3 Monate' }))

    expect(screen.getByRole('region', { name: 'Monatsziel' }).textContent).toBe(before)
  })

  it('places the range switch in its own section for the cards below it', async () => {
    renderDashboard()
    const heading = await screen.findByRole('heading', { level: 2, name: 'Auswertung' })
    expect(heading).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Zeitraum' })).toBeInTheDocument()
  })

  it('lets the user set a first goal and validates it', async () => {
    mockedApi.fetchMonthlyGoal.mockResolvedValue(null)
    const user = userEvent.setup()
    renderDashboard()
    const goal = await screen.findByRole('region', { name: 'Monatsziel' })
    await user.click(within(goal).getByRole('button', { name: 'Monatsziel festlegen' }))
    const dialog = screen.getByRole('dialog', { name: 'Monatsziel' })
    const input = within(dialog).getByLabelText('Monatsziel in kg CO₂e')
    // The average of the completed months as orientation: (0+0+0+20+15) / 5
    expect(input).toHaveAccessibleDescription(/im Schnitt 7 kg pro Monat/)

    await user.type(input, '-3')
    await user.click(within(dialog).getByRole('button', { name: 'Ziel speichern' }))
    expect(input).toHaveAccessibleDescription('Bitte einen Wert zwischen 0 und 10.000 kg eingeben.')
    expect(mockedApi.saveMonthlyGoal).not.toHaveBeenCalled()

    await user.clear(input)
    await user.type(input, '60,5')
    await user.click(within(dialog).getByRole('button', { name: 'Ziel speichern' }))
    expect(mockedApi.saveMonthlyGoal).toHaveBeenCalledWith(60.5, null)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows an empty state with a call to action', async () => {
    mockedApi.fetchMonthlyTotals.mockResolvedValue([])
    mockedApi.fetchGroupTotals.mockResolvedValue([])
    mockedApi.fetchHotspots.mockResolvedValue([])
    renderDashboard()

    expect(
      await screen.findByText('Noch keine bestätigten Belege in diesem Zeitraum'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beleg hochladen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beispielbeleg ausprobieren' })).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    mockedApi.fetchHotspots.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    renderDashboard()

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('region', { name: 'Hotspots' })).toBeInTheDocument()
  })
})
