import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import type { EmissionCategory } from '@/features/categories/categories'
import * as categoriesApi from '@/features/categories/api'
import { receiptFixture } from '@/features/receipts/test-fixtures'
import { authenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import * as api from './api'
import type { LineItem } from './review-logic'

vi.mock('./api')
vi.mock('@/features/categories/api')

const mockedApi = vi.mocked(api)

const category = (overrides: Partial<EmissionCategory>): EmissionCategory => ({
  id: 'x',
  slug: 'x',
  label: 'X',
  unit: 'kg',
  co2e_per_unit: 1,
  category_group: 'meat_fish',
  source: 'ifeu 2020',
  source_url: 'https://example.com/ifeu.pdf',
  ...overrides,
})
const categories = [
  category({ id: 'beef', slug: 'ground-beef', label: 'Rinderhackfleisch', co2e_per_unit: 9.2 }),
  category({
    id: 'cheese',
    slug: 'cheese',
    label: 'Käse',
    category_group: 'dairy_eggs',
    co2e_per_unit: 5.7,
  }),
  category({
    id: 'oat',
    slug: 'oat-drink',
    label: 'Haferdrink',
    unit: 'l',
    category_group: 'plant_protein',
    co2e_per_unit: 0.3,
  }),
]

const receipt = receiptFixture({
  id: 'r1',
  status: 'review',
  merchant: 'Beispielmarkt',
  purchased_at: '2026-11-06',
})

function item(overrides: Partial<LineItem>): LineItem {
  return {
    id: crypto.randomUUID(),
    receipt_id: 'r1',
    user_id: 'u',
    raw_text: 'X',
    normalized_name: 'x',
    quantity: null,
    unit: null,
    price: 1,
    category_id: null,
    confidence: 0,
    reviewed: false,
    quantity_source: null,
    co2e_kg: null,
    created_at: '2026-11-07T10:00:00Z',
    updated_at: '2026-11-07T10:00:00Z',
    ...overrides,
  }
}

const beef = item({
  id: 'i-beef',
  raw_text: 'Rinderhack 500g',
  normalized_name: 'rinderhack',
  quantity: 0.5,
  unit: 'kg',
  category_id: 'beef',
  confidence: 0.95,
  co2e_kg: 4.6,
})
const gouda = item({
  id: 'i-gouda',
  raw_text: 'Gouda jung Scheiben',
  normalized_name: 'gouda jung scheiben',
  category_id: 'beef',
  confidence: 0.4,
})

function renderReview() {
  return renderRoutes(routes, { initialPath: '/receipts/r1', auth: authenticated })
}

function row(name: string) {
  return screen.getByRole('form', { name })
}

describe('ReviewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(categories)
    mockedApi.fetchReceipt.mockResolvedValue(receipt)
    mockedApi.fetchLineItems.mockResolvedValue([beef, gouda])
    mockedApi.fetchImageUrl.mockResolvedValue('https://example.com/signed.jpg')
    mockedApi.saveLineItem.mockResolvedValue({ appliedTo: 0 })
    mockedApi.confirmReceipt.mockResolvedValue()
  })

  it('shows the receipt, the total and flags uncertain items', async () => {
    renderReview()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Beispielmarkt' }),
    ).toBeInTheDocument()
    expect(screen.getByText('4,6 kg CO₂e', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('1 Position braucht deine Prüfung')).toBeInTheDocument()

    const goudaRow = row('Gouda jung Scheiben')
    expect(within(goudaRow).getByText('Kategorie unsicher')).toBeInTheDocument()
    expect(within(goudaRow).getByText('Kein CO₂-Wert: Menge fehlt')).toBeInTheDocument()
    expect(within(row('Rinderhack 500g')).queryByText('Kategorie unsicher')).not.toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /Foto des Kassenbons/ })).toHaveAttribute(
      'src',
      'https://example.com/signed.jpg',
    )
  })

  it('previews CO2e live and saves a correction including the learned mapping', async () => {
    const user = userEvent.setup()
    renderReview()
    const goudaRow = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.selectOptions(within(goudaRow).getByLabelText('Kategorie'), 'Käse')
    await user.type(within(goudaRow).getByLabelText('Menge'), '0,2')
    await user.selectOptions(within(goudaRow).getByLabelText('Einheit'), 'kg')

    expect(within(goudaRow).getByText('1,14 kg CO₂e')).toBeInTheDocument()
    await user.click(within(goudaRow).getByRole('button', { name: 'Speichern' }))

    expect(mockedApi.saveLineItem).toHaveBeenCalledWith(
      {
        id: 'i-gouda',
        normalizedName: 'gouda jung scheiben',
        categoryId: 'cheese',
        quantity: 0.2,
        unit: 'kg',
        co2eKg: 1.14,
        category: expect.objectContaining({ id: 'cheese', co2e_per_unit: 5.7 }),
      },
      expect.anything(),
    )
  })

  it('confirms an unchanged item', async () => {
    const user = userEvent.setup()
    renderReview()
    const beefRow = await screen.findByRole('form', { name: 'Rinderhack 500g' })

    await user.click(within(beefRow).getByRole('button', { name: 'Passt so' }))

    expect(mockedApi.saveLineItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i-beef', categoryId: 'beef', co2eKg: 4.6 }),
      expect.anything(),
    )
  })

  it('tells the user when a correction was applied to other open items', async () => {
    mockedApi.saveLineItem.mockResolvedValue({ appliedTo: 2 })
    const user = userEvent.setup()
    renderReview()
    const beefRow = await screen.findByRole('form', { name: 'Rinderhack 500g' })

    await user.click(within(beefRow).getByRole('button', { name: 'Passt so' }))

    expect(
      await within(beefRow).findByText('Auch bei 2 weiteren offenen Positionen übernommen'),
    ).toBeInTheDocument()
  })

  it('flags estimated amounts and explains where they come from', async () => {
    mockedApi.fetchLineItems.mockResolvedValue([
      {
        ...gouda,
        quantity: 0.15,
        unit: 'kg',
        quantity_source: 'estimated',
        category_id: 'cheese',
        confidence: 0.9,
        co2e_kg: 0.855,
      },
    ])
    renderReview()
    const goudaRow = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    expect(within(goudaRow).getByText('Menge geschätzt')).toBeInTheDocument()
    expect(within(goudaRow).getByText(/von der KI geschätzt/)).toBeInTheDocument()
    expect(within(goudaRow).getByLabelText('Menge')).toHaveValue('0,15')
  })

  it('rejects an invalid quantity', async () => {
    const user = userEvent.setup()
    renderReview()
    const goudaRow = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.type(within(goudaRow).getByLabelText('Menge'), 'viel')
    await user.click(within(goudaRow).getByRole('button', { name: 'Speichern' }))

    expect(within(goudaRow).getByLabelText('Menge')).toHaveAccessibleDescription(
      'Bitte eine positive Zahl eingeben, z. B. 0,5',
    )
    expect(mockedApi.saveLineItem).not.toHaveBeenCalled()
  })

  it('confirms the whole receipt', async () => {
    const user = userEvent.setup()
    renderReview()

    expect(
      await screen.findByText('1 Position ohne CO₂-Wert zählt nicht zur Summe.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Beleg bestätigen' }))

    expect(mockedApi.confirmReceipt).toHaveBeenCalledTimes(1)
  })

  it('shows a not-found state', async () => {
    mockedApi.fetchReceipt.mockResolvedValue(null)
    renderReview()
    expect(await screen.findByRole('heading', { name: 'Beleg nicht gefunden' })).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    mockedApi.fetchLineItems.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    renderReview()

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Erneut versuchen' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Beispielmarkt' }),
    ).toBeInTheDocument()
  })
})
