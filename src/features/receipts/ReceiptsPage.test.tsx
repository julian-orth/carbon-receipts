import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import { authenticated, testUser } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import * as api from './api'
import { useReceiptsRealtime } from './realtime'
import { receiptFixture } from './test-fixtures'

vi.mock('./api')
vi.mock(import('./realtime'), async (importOriginal) => ({
  ...(await importOriginal()),
  useReceiptsRealtime: vi.fn<typeof useReceiptsRealtime>(),
}))

const mockedApi = vi.mocked(api)

function renderPage() {
  return renderRoutes(routes, { initialPath: '/receipts', auth: authenticated })
}

function jpeg(name = 'rewe.jpg') {
  return new File(['x'.repeat(100)], name, { type: 'image/jpeg' })
}

describe('ReceiptsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedApi.fetchReceiptTotals.mockResolvedValue(new Map())
  })

  it('subscribes to realtime updates for the current user', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    renderPage()
    await screen.findByText('Noch keine Belege')
    expect(useReceiptsRealtime).toHaveBeenCalledWith(testUser.id)
  })

  it('shows a loading state, then running and finished receipts separately', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([
      receiptFixture({
        original_filename: 'rewe.jpg',
        status: 'processing',
        processing_step: 'reading',
        updated_at: new Date().toISOString(),
      }),
      receiptFixture({ merchant: 'Edeka', status: 'review' }),
    ])
    renderPage()

    expect(await screen.findByRole('status', { name: 'Belege werden geladen' })).toBeInTheDocument()

    const active = await screen.findByRole('list', { name: 'In Arbeit' })
    expect(within(active).getByRole('listitem')).toHaveTextContent(
      /rewe\.jpg.*Schritt 2 von 5 · Die KI liest deinen Bon/,
    )
    expect(within(active).getByRole('link', { name: /Live ansehen/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/live$/),
    )

    const list = screen.getByRole('list', { name: 'Deine Belege' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent(/Edeka.*Bitte prüfen/)
  })

  it('shows the CO2e total and item count per receipt', async () => {
    const receipt = receiptFixture({ merchant: 'Wochenmarkt', status: 'review' })
    mockedApi.fetchReceipts.mockResolvedValue([receipt])
    mockedApi.fetchReceiptTotals.mockResolvedValue(
      new Map([[receipt.id, { itemCount: 6, co2eKg: 9.28 }]]),
    )
    renderPage()

    const list = await screen.findByRole('list', { name: 'Deine Belege' })
    const item = within(list).getByRole('listitem')
    expect(await within(item).findByText('9,28 kg')).toBeInTheDocument()
    expect(item).toHaveTextContent('6 Positionen')
  })

  it('shows an empty state', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Noch keine Belege')).toBeInTheDocument()
  })

  it('shows an error state with a working retry', async () => {
    mockedApi.fetchReceipts.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Belege konnten nicht geladen werden')
    await user.click(within(alert).getByRole('button', { name: 'Erneut versuchen' }))

    expect(await screen.findByText('Noch keine Belege')).toBeInTheDocument()
  })

  it('uploads a valid file and opens the live view', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    const receipt = receiptFixture({ status: 'processing', processing_step: 'reading' })
    mockedApi.uploadReceipt.mockResolvedValue({ receipt, processingStarted: true })
    const user = userEvent.setup()
    const { router } = renderPage()
    await screen.findByText('Noch keine Belege')

    const file = jpeg()
    await user.upload(screen.getByLabelText(/Foto auswählen/), file)

    await waitFor(() =>
      expect(mockedApi.uploadReceipt).toHaveBeenCalledWith(
        { file, userId: testUser.id },
        expect.anything(),
      ),
    )
    await waitFor(() => expect(router.state.location.pathname).toBe(`/receipts/${receipt.id}/live`))
    expect(router.state.location.state).toEqual({ fromUpload: true })
  })

  it('rejects unsupported files without uploading', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    const user = userEvent.setup({ applyAccept: false })
    renderPage()
    await screen.findByText('Noch keine Belege')

    await user.upload(
      screen.getByLabelText(/Foto auswählen/),
      new File(['%PDF'], 'bon.pdf', { type: 'application/pdf' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/nicht unterstützt/)
    expect(mockedApi.uploadReceipt).not.toHaveBeenCalled()
  })

  it('shows an error when the upload fails', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    mockedApi.uploadReceipt.mockRejectedValue(new Error('storage down'))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Noch keine Belege')

    await user.upload(screen.getByLabelText(/Foto auswählen/), jpeg())

    expect(await screen.findByRole('alert')).toHaveTextContent(/Upload ist fehlgeschlagen/)
  })

  it('retries a failed receipt and shows the error reason', async () => {
    const failed = receiptFixture({ status: 'failed', error: 'Kein Text erkannt' })
    mockedApi.fetchReceipts.mockResolvedValue([failed])
    mockedApi.retryReceipt.mockResolvedValue()
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Kein Text erkannt')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(mockedApi.retryReceipt).toHaveBeenCalledWith(failed.id, expect.anything())
  })

  it('deletes a receipt only after confirmation', async () => {
    const receipt = receiptFixture({ original_filename: 'rewe.jpg' })
    mockedApi.fetchReceipts.mockResolvedValue([receipt])
    mockedApi.deleteReceipt.mockResolvedValue()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'rewe.jpg löschen' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Beleg löschen?' })

    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    expect(mockedApi.deleteReceipt).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'rewe.jpg löschen' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Löschen' }),
    )
    expect(mockedApi.deleteReceipt).toHaveBeenCalledWith(receipt, expect.anything())
  })

  it('offers to start the analysis for pending receipts', async () => {
    const pending = receiptFixture({ status: 'pending' })
    mockedApi.fetchReceipts.mockResolvedValue([pending])
    mockedApi.startProcessing.mockResolvedValue()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Analyse starten' }))
    expect(mockedApi.startProcessing).toHaveBeenCalledWith(pending.id, expect.anything())
  })

  it('links receipts in review to the review screen', async () => {
    const review = receiptFixture({ status: 'review', merchant: 'Edeka' })
    mockedApi.fetchReceipts.mockResolvedValue([review])
    renderPage()

    expect(await screen.findByRole('link', { name: 'Prüfen' })).toHaveAttribute(
      'href',
      `/receipts/${review.id}`,
    )
    expect(screen.getByRole('link', { name: 'Edeka' })).toHaveAttribute(
      'href',
      `/receipts/${review.id}`,
    )
  })
})
