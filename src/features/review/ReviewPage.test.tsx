import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import type { EmissionCategory } from '@/features/categories/categories'
import * as categoriesApi from '@/features/categories/api'
import * as receiptsApi from '@/features/receipts/api'
import { receiptKeys } from '@/features/receipts/query-keys'
import type { useReceiptsRealtime } from '@/features/receipts/realtime'
import { receiptFixture } from '@/features/receipts/test-fixtures'
import type { Receipt } from '@/features/receipts/types'
import { authenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import * as api from './api'
import type { LineItem } from './review-logic'

vi.mock('./api')
vi.mock('@/features/categories/api')
vi.mock('@/features/receipts/api')
vi.mock('@/features/processing/timing', () => ({
  MIN_STEP_MS: 0,
  COUNT_UP_MS: 0,
  CREEP_MS: [0, 0, 0, 0, 0],
}))
vi.mock(import('@/features/receipts/realtime'), async (importOriginal) => ({
  ...(await importOriginal()),
  useReceiptsRealtime: vi.fn<typeof useReceiptsRealtime>(),
}))

const mockedApi = vi.mocked(api)
const receipts = vi.mocked(receiptsApi)

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
    position: 1,
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
  position: 1,
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
  position: 2,
  raw_text: 'Gouda jung Scheiben',
  normalized_name: 'gouda jung scheiben',
  category_id: 'beef',
  confidence: 0.4,
})

function renderReceipt(current: Receipt = receipt, state: unknown = null) {
  receipts.fetchReceipts.mockResolvedValue([current])
  return renderRoutes(routes, {
    initialPath: `/receipts/${current.id}`,
    initialState: state,
    auth: authenticated,
  })
}

/** The editor of a line (a form named after the receipt text). */
const editor = (name: string) => screen.getByRole('form', { name })
const toggle = (name: RegExp) => screen.getByRole('button', { name, expanded: false })

describe('ReviewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(categories)
    receipts.fetchReceiptTotals.mockResolvedValue(new Map())
    mockedApi.fetchLineItems.mockResolvedValue([beef, gouda])
    mockedApi.fetchImageUrl.mockResolvedValue('https://example.com/signed.jpg')
    mockedApi.saveLineItem.mockResolvedValue({ appliedTo: 0 })
    mockedApi.confirmReceipt.mockResolvedValue()
  })

  it('shows the receipt, its progress and opens the first line that needs a look', async () => {
    renderReceipt()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Beispielmarkt' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('1 von 2 geprüft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zu prüfen 1/ })).toBeInTheDocument()

    // Gouda (uncertain, no amount) is open, the plausible beef line is collapsed.
    const goudaEditor = editor('Gouda jung Scheiben')
    expect(within(goudaEditor).getByText('Kategorie unsicher')).toBeInTheDocument()
    expect(within(goudaEditor).getByText('Kein CO₂-Wert: Menge fehlt')).toBeInTheDocument()
    expect(toggle(/Rinderhack 500g/)).toHaveTextContent(/Rinderhackfleisch.*0,5 kg.*Plausibel/)
    expect(await screen.findByRole('img', { name: 'Foto des Kassenbons' })).toHaveAttribute(
      'src',
      'https://example.com/signed.jpg',
    )
  })

  it('picks a category from the suggestions, previews CO2e and saves the correction', async () => {
    const user = userEvent.setup()
    renderReceipt()
    const goudaEditor = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.click(within(goudaEditor).getByRole('button', { name: /Kategorie/ }))
    const suggestions = screen.getByRole('group', { name: 'Passend zu „Gouda jung Scheiben“' })
    // current (uncertain) choice first, then the keyword match "Gouda" → Käse
    expect(
      within(suggestions)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([expect.stringContaining('Rinderhackfleisch'), expect.stringContaining('Käse')])
    await user.click(within(suggestions).getByRole('option', { name: /Käse/ }))

    await user.type(within(goudaEditor).getByLabelText('Menge'), '0,2')
    // the category's unit was preselected because the line had no amount
    expect(within(goudaEditor).getByRole('radio', { name: 'kg' })).toBeChecked()
    expect(within(goudaEditor).getByText('1,14 kg CO₂e')).toBeInTheDocument()
    expect(within(goudaEditor).getByText(/0,2 kg × 5,7 kg CO₂e\/kg/)).toBeInTheDocument()

    await user.click(within(goudaEditor).getByRole('button', { name: /Speichern/ }))
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

  it('searches categories by keyboard', async () => {
    const user = userEvent.setup()
    renderReceipt()
    const goudaEditor = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.click(within(goudaEditor).getByRole('button', { name: /Kategorie/ }))
    const search = screen.getByRole('combobox', { name: 'Kategorie suchen' })
    expect(search).toHaveFocus()
    await user.type(search, 'hafer')
    expect(search).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Haferdrink/ }).id,
    )
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(within(goudaEditor).getByRole('button', { name: /Kategorie/ })).toHaveTextContent(
      'Haferdrink',
    )
    expect(within(goudaEditor).getByRole('radio', { name: 'Liter' })).toBeChecked()
  })

  it('offers to fix a unit that does not fit the category', async () => {
    mockedApi.fetchLineItems.mockResolvedValue([
      { ...gouda, category_id: 'oat', quantity: 1, unit: 'piece', confidence: 0.4 },
    ])
    const user = userEvent.setup()
    renderReceipt()
    const goudaEditor = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.click(within(goudaEditor).getByRole('button', { name: 'Einheit auf Liter stellen' }))
    expect(within(goudaEditor).getByRole('radio', { name: 'Liter' })).toBeChecked()
    expect(within(goudaEditor).getByText('300 g CO₂e')).toBeInTheDocument()
  })

  it('confirms an unchanged line and moves on to the next open one', async () => {
    mockedApi.saveLineItem.mockResolvedValue({ appliedTo: 2 })
    const user = userEvent.setup()
    renderReceipt()
    await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.click(toggle(/Rinderhack 500g/))
    const beefEditor = editor('Rinderhack 500g')
    await user.click(within(beefEditor).getByRole('button', { name: /Passt so/ }))

    expect(mockedApi.saveLineItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i-beef', categoryId: 'beef', co2eKg: 4.6 }),
      expect.anything(),
    )
    expect(
      await screen.findByText(
        'Rinderhack 500g gespeichert, auch bei 2 weiteren offenen Positionen übernommen.',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Gouda jung Scheiben/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      ),
    )
    expect(screen.getByRole('button', { name: /Gouda jung Scheiben/ })).toHaveFocus()
  })

  it('filters the lines that still need a look', async () => {
    const user = userEvent.setup()
    renderReceipt()
    await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.click(screen.getByRole('button', { name: /Zu prüfen/ }))
    expect(screen.queryByRole('button', { name: /Rinderhack 500g/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gouda jung Scheiben/ })).toBeInTheDocument()
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
    renderReceipt()
    const goudaEditor = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    expect(within(goudaEditor).getByText('Menge geschätzt')).toBeInTheDocument()
    expect(within(goudaEditor).getByText(/von der KI geschätzt/)).toBeInTheDocument()
    expect(within(goudaEditor).getByLabelText('Menge')).toHaveValue('0,15')
  })

  it('rejects an invalid quantity', async () => {
    const user = userEvent.setup()
    renderReceipt()
    const goudaEditor = await screen.findByRole('form', { name: 'Gouda jung Scheiben' })

    await user.type(within(goudaEditor).getByLabelText('Menge'), 'viel')
    await user.click(within(goudaEditor).getByRole('button', { name: /Speichern/ }))

    expect(within(goudaEditor).getByLabelText('Menge')).toHaveAccessibleDescription(
      'Bitte eine positive Zahl eingeben, z. B. 0,5',
    )
    expect(mockedApi.saveLineItem).not.toHaveBeenCalled()
  })

  it('confirms the whole receipt', async () => {
    const user = userEvent.setup()
    renderReceipt()

    expect(await screen.findByText(/1 Position ist noch offen/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Beleg bestätigen' }))

    expect(mockedApi.confirmReceipt).toHaveBeenCalledTimes(1)
  })

  it('shows a not-found state', async () => {
    receipts.fetchReceipts.mockResolvedValue([])
    renderRoutes(routes, { initialPath: '/receipts/unknown', auth: authenticated })
    expect(await screen.findByRole('heading', { name: 'Beleg nicht gefunden' })).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    mockedApi.fetchLineItems.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    renderReceipt()

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('form', { name: 'Gouda jung Scheiben' })).toBeInTheDocument()
  })
})

describe('ReviewPage while the receipt is analysed', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue(categories)
    receipts.fetchReceiptTotals.mockResolvedValue(new Map())
    mockedApi.fetchImageUrl.mockResolvedValue('https://example.test/bon.jpg')
  })

  it('follows the analysis in a dialog and then hands over to the review', async () => {
    const running = receiptFixture({
      original_filename: 'wochenmarkt.jpg',
      status: 'processing',
      processing_step: 'reading',
      ai_provider: 'gemini',
      updated_at: new Date().toISOString(),
    })
    const user = userEvent.setup()
    const { queryClient } = renderReceipt(running, { fromUpload: true })

    const dialog = await screen.findByRole('dialog', { name: 'Bon wird gelesen …' })
    expect(within(dialog).getByText('Bon lesen: läuft')).toBeInTheDocument()
    // Plain language for users: no provider names, no "KI/Code" labels.
    expect(dialog).not.toHaveTextContent(/Gemini|Groq|\bCode\b/)

    // The edge function falls back to Groq, then finishes (Realtime → cache).
    act(() => {
      queryClient.setQueryData<Receipt[]>(receiptKeys.list(), [{ ...running, ai_provider: 'groq' }])
    })
    expect(await within(dialog).findByText(/Dauert gerade etwas länger/)).toBeInTheDocument()

    mockedApi.fetchLineItems.mockResolvedValue([
      { ...beef, receipt_id: running.id },
      { ...gouda, receipt_id: running.id },
    ])
    act(() => {
      queryClient.setQueryData<Receipt[]>(receiptKeys.list(), [
        {
          ...running,
          ai_provider: 'groq',
          status: 'review',
          merchant: 'Wochenmarkt',
          processing_step: null,
        },
      ])
    })

    const done = await screen.findByRole('dialog', {
      name: 'Fertig! 1 Position braucht deinen Blick.',
    })
    expect(within(done).getAllByText(/: erledigt$/)).toHaveLength(5)
    // The drawn receipt has filled up with the lines, in receipt order.
    const printed = within(within(done).getByRole('list', { name: 'Erkannte Positionen' }))
      .getAllByRole('listitem')
      .map((line) => line.textContent)
    expect(printed).toEqual([
      expect.stringMatching(/Rinderhack 500g.*Rinderhackfleisch.*4,60 kg/),
      expect.stringMatching(/Gouda jung Scheiben.*prüfen/),
    ])

    await user.click(within(done).getByRole('button', { name: /Positionen prüfen/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Gouda jung Scheiben' })).toBeInTheDocument()
  })

  it('keeps running in the background and can show the progress again', async () => {
    const running = receiptFixture({
      status: 'processing',
      processing_step: 'reading',
      updated_at: new Date().toISOString(),
    })
    const user = userEvent.setup()
    renderReceipt(running)

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Im Hintergrund weiter' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Wird analysiert: Bon lesen' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fortschritt anzeigen' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows where a run failed and retries it', async () => {
    const failed = receiptFixture({
      status: 'failed',
      processing_step: 'reading',
      error: 'Die KI-Dienste sind gerade nicht erreichbar.',
    })
    receipts.retryReceipt.mockResolvedValue()
    const user = userEvent.setup()
    renderReceipt(failed)

    const dialog = await screen.findByRole('dialog', { name: 'Das hat leider nicht geklappt' })
    expect(within(dialog).getByText('Bon lesen: fehlgeschlagen')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Die KI-Dienste sind gerade nicht erreichbar.')

    await user.click(within(dialog).getByRole('button', { name: 'Erneut versuchen' }))
    expect(receipts.retryReceipt).toHaveBeenCalledWith(failed.id, expect.anything())
  })

  it('offers to start a receipt that is still pending', async () => {
    const pending = receiptFixture({ status: 'pending', updated_at: new Date().toISOString() })
    receipts.startProcessing.mockResolvedValue()
    const user = userEvent.setup()
    renderReceipt(pending, { fromUpload: true })

    const dialog = await screen.findByRole('dialog', { name: 'Wartet auf den Start' })
    await user.click(within(dialog).getByRole('button', { name: 'Analyse starten' }))
    expect(receipts.startProcessing).toHaveBeenCalledWith(pending.id, expect.anything())
  })

  it('opens a receipt finished earlier without the dialog', async () => {
    mockedApi.fetchLineItems.mockResolvedValue([beef])
    renderReceipt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Beispielmarkt' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
