import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as categoriesApi from '@/features/categories/api'
import type { EmissionCategory } from '@/features/categories/categories'
import { authenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import { FactorsPage } from './FactorsPage'

vi.mock('@/features/categories/api')

const factor = (
  slug: string,
  label: string,
  group: string,
  overrides: Partial<EmissionCategory> = {},
): EmissionCategory => ({
  id: slug,
  slug,
  label,
  unit: 'kg',
  co2e_per_unit: 2.5,
  category_group: group,
  source: `ifeu 2020, Tab. 1 – ${label}`,
  source_url: 'https://www.ifeu.de/x.pdf',
  ...overrides,
})

const data = [
  factor('beef', 'Rindfleisch', 'meat_fish', { co2e_per_unit: 13.6 }),
  factor('apples', 'Äpfel', 'fruit_vegetables', { co2e_per_unit: 0.3 }),
  factor('diesel', 'Diesel', 'fuel', {
    unit: 'l',
    co2e_per_unit: 2.62,
    source: 'BAFU – Diesel',
    source_url: 'https://www.bafu.admin.ch/y.pdf',
  }),
  factor('eggs', 'Eier', 'dairy_eggs', { unit: 'piece', co2e_per_unit: 0.18 }),
]

/** Value (dd) next to a key-figure label (dt). */
const stat = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling

function renderPage() {
  return renderRoutes([{ path: '/', element: <FactorsPage /> }], { auth: authenticated })
}

describe('FactorsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lists every factor with value, unit and a source link', async () => {
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(data)
    renderPage()

    const all = await screen.findByRole('region', { name: 'Alle Faktoren' })
    expect(within(all).getAllByRole('listitem')).toHaveLength(data.length)
    expect(within(all).getByText('13,6 kg CO₂e/kg')).toBeInTheDocument()
    expect(within(all).getByText('2,62 kg CO₂e/l')).toBeInTheDocument()
    expect(within(all).getByText('0,18 kg CO₂e/Stk.')).toBeInTheDocument()
    expect(within(all).getByRole('link', { name: /BAFU – Diesel/ })).toHaveAttribute(
      'href',
      'https://www.bafu.admin.ch/y.pdf',
    )
    expect(screen.getByText('4 Faktoren in 4 Gruppen')).toBeInTheDocument()
  })

  it('summarizes factors, groups and sources', async () => {
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(data)
    renderPage()
    await screen.findByRole('region', { name: 'Alle Faktoren' })

    expect(stat('Faktoren')).toHaveTextContent('4')
    expect(stat('Gruppen')).toHaveTextContent('4')
    expect(stat('Quellen')).toHaveTextContent('2')
    const sources = screen.getByRole('region', { name: 'Quellen' })
    expect(within(sources).getAllByRole('listitem')).toHaveLength(2)
  })

  it('filters by search and reports how many match', async () => {
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(data)
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('region', { name: 'Alle Faktoren' })

    await user.type(screen.getByRole('searchbox', { name: 'Faktoren durchsuchen' }), 'diesel')
    const all = screen.getByRole('region', { name: 'Alle Faktoren' })
    expect(within(all).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('1 von 4 Faktoren')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Faktoren durchsuchen' }))
    await user.type(screen.getByRole('searchbox', { name: 'Faktoren durchsuchen' }), 'nichts')
    expect(screen.getByText('Kein Faktor passt zu „nichts“.')).toBeInTheDocument()
  })

  it('warns when a factor has no source link', async () => {
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue([
      ...data,
      factor('x', 'Ohne Link', 'other', { source_url: null }),
    ])
    renderPage()
    expect(await screen.findByText('1 Faktor hat keinen Quellenlink.')).toBeInTheDocument()
  })

  it('shows a loading state, then an error with retry', async () => {
    vi.mocked(categoriesApi.fetchCategories).mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByRole('status', { name: 'Faktoren werden geladen' })).toBeInTheDocument()
    expect(await screen.findByText('Faktoren konnten nicht geladen werden')).toBeInTheDocument()

    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(data)
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('region', { name: 'Alle Faktoren' })).toBeInTheDocument()
  })

  it('shows an empty state without factors', async () => {
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue([])
    renderPage()
    expect(
      await screen.findByText('Es sind noch keine Emissionsfaktoren hinterlegt.'),
    ).toBeInTheDocument()
  })
})
