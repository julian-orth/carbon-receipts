import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import type { EmissionCategory } from '@/features/categories/categories'
import * as categoriesApi from '@/features/categories/api'
import * as receiptsApi from '@/features/receipts/api'
import { receiptKeys } from '@/features/receipts/query-keys'
import { useReceiptsRealtime } from '@/features/receipts/realtime'
import { receiptFixture } from '@/features/receipts/test-fixtures'
import type { Receipt } from '@/features/receipts/types'
import * as reviewApi from '@/features/review/api'
import type { LineItem } from '@/features/review/review-logic'
import { authenticated, testUser } from '@/test/auth'
import { renderRoutes } from '@/test/render'

vi.mock('./timing', () => ({ MIN_STEP_MS: 0, COUNT_UP_MS: 0, CREEP_MS: [0, 0, 0, 0, 0] }))
vi.mock('@/features/receipts/api')
vi.mock('@/features/review/api')
vi.mock('@/features/categories/api')
vi.mock(import('@/features/receipts/realtime'), async (importOriginal) => ({
  ...(await importOriginal()),
  useReceiptsRealtime: vi.fn<typeof useReceiptsRealtime>(),
}))

const receipts = vi.mocked(receiptsApi)
const review = vi.mocked(reviewApi)

const cheese: EmissionCategory = {
  id: 'cat-cheese',
  slug: 'cheese',
  label: 'Käse',
  unit: 'kg',
  co2e_per_unit: 5.7,
  category_group: 'dairy_eggs',
  source: 'ifeu',
  source_url: null,
}

function lineItem(overrides: Partial<LineItem>): LineItem {
  return {
    id: crypto.randomUUID(),
    receipt_id: 'r',
    user_id: testUser.id,
    raw_text: 'Bergkäse',
    normalized_name: 'bergkase',
    quantity: 0.3,
    unit: 'kg',
    quantity_source: 'receipt',
    price: 6.9,
    category_id: cheese.id,
    confidence: 0.95,
    reviewed: false,
    co2e_kg: 1.71,
    created_at: '2026-11-09T10:00:00Z',
    updated_at: '2026-11-09T10:00:00Z',
    ...overrides,
  }
}

function renderLive(receipt: Receipt, state: unknown = { fromUpload: true }) {
  receipts.fetchReceipts.mockResolvedValue([receipt])
  return renderRoutes(routes, {
    initialPath: `/receipts/${receipt.id}/live`,
    initialState: state,
    auth: authenticated,
  })
}

describe('ProcessingPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(categoriesApi).fetchCategories.mockResolvedValue([cheese])
    review.fetchImageUrl.mockResolvedValue('https://example.test/bon.jpg')
    receipts.fetchReceiptTotals.mockResolvedValue(new Map())
  })

  it('follows the pipeline live and prints the result', async () => {
    const receipt = receiptFixture({
      original_filename: 'wochenmarkt.jpg',
      status: 'processing',
      processing_step: 'reading',
      ai_provider: 'gemini',
      updated_at: new Date().toISOString(),
    })
    const { queryClient } = renderLive(receipt)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Die KI liest deinen Bon' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('log')).toHaveTextContent('Anfrage an Gemini')
    expect(useReceiptsRealtime).toHaveBeenCalledWith(testUser.id)

    // The edge function falls back to Groq, then finishes (Realtime → cache).
    act(() => {
      queryClient.setQueryData<Receipt[]>(receiptKeys.list(), [{ ...receipt, ai_provider: 'groq' }])
    })
    expect(
      await screen.findByText('Gemini nicht verfügbar · Fallback auf Groq'),
    ).toBeInTheDocument()

    review.fetchLineItems.mockResolvedValue([
      lineItem({ receipt_id: receipt.id }),
      lineItem({
        receipt_id: receipt.id,
        raw_text: 'Wildlachs',
        category_id: null,
        quantity: null,
        unit: null,
        co2e_kg: null,
      }),
    ])
    act(() => {
      queryClient.setQueryData<Receipt[]>(receiptKeys.list(), [
        {
          ...receipt,
          ai_provider: 'groq',
          status: 'review',
          merchant: 'Wochenmarkt',
          processing_step: null,
        },
      ])
    })

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Fertig\. 1 Position braucht deinen Blick/,
      }),
    ).toBeInTheDocument()
    const tape = screen.getByRole('region', { name: 'Wochenmarkt' })
    const items = within(
      within(tape).getByRole('list', { name: 'Erkannte Positionen' }),
    ).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/Bergkäse.*Käse.*0,3 kg.*1,71 kg/)
    expect(items[1]).toHaveTextContent(/Wildlachs.*Kategorie fehlt.*kein Wert/)
    expect(within(tape).getByText('1,71')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Beleg prüfen/ })).toHaveAttribute(
      'href',
      `/receipts/${receipt.id}`,
    )
    // every step is completed
    expect(screen.getAllByText(/: erledigt$/)).toHaveLength(5)
  })

  it('shows where a run failed and retries it', async () => {
    const receipt = receiptFixture({
      status: 'failed',
      processing_step: 'reading',
      error: 'Die KI-Dienste sind gerade nicht erreichbar.',
    })
    receipts.retryReceipt.mockResolvedValue()
    const user = userEvent.setup()
    renderLive(receipt, null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Das hat nicht geklappt' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Lesen (KI): fehlgeschlagen')).toBeInTheDocument()
    expect(screen.getByRole('log')).toHaveTextContent(
      'Die KI-Dienste sind gerade nicht erreichbar.',
    )

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(receipts.retryReceipt).toHaveBeenCalledWith(receipt.id, expect.anything())
  })

  it('offers to start a receipt that is still pending', async () => {
    const receipt = receiptFixture({ status: 'pending', updated_at: new Date().toISOString() })
    receipts.startProcessing.mockResolvedValue()
    const user = userEvent.setup()
    renderLive(receipt)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Wartet auf den Start' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Analyse starten' }))
    expect(receipts.startProcessing).toHaveBeenCalledWith(receipt.id, expect.anything())
  })

  it('sends finished receipts opened later straight to the review', async () => {
    const receipt = receiptFixture({ status: 'review' })
    review.fetchReceipt.mockResolvedValue(receipt)
    review.fetchLineItems.mockResolvedValue([])
    const { router } = renderLive(receipt, null)

    await waitFor(() => expect(router.state.location.pathname).toBe(`/receipts/${receipt.id}`))
  })

  it('tells the user when the receipt does not exist', async () => {
    receipts.fetchReceipts.mockResolvedValue([])
    renderRoutes(routes, { initialPath: '/receipts/unknown/live', auth: authenticated })
    expect(await screen.findByRole('heading', { name: 'Beleg nicht gefunden' })).toBeInTheDocument()
  })
})
