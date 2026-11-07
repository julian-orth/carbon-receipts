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
  })

  it('subscribes to realtime updates for the current user', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    renderPage()
    await screen.findByText('Noch keine Belege')
    expect(useReceiptsRealtime).toHaveBeenCalledWith(testUser.id)
  })

  it('shows a loading state, then the receipts with their status', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([
      receiptFixture({ original_filename: 'rewe.jpg', status: 'processing' }),
      receiptFixture({ merchant: 'Edeka', status: 'review' }),
    ])
    renderPage()

    expect(screen.getByRole('status', { name: 'Belege werden geladen' })).toBeInTheDocument()

    const list = await screen.findByRole('list', { name: 'Deine Belege' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(/rewe\.jpg.*Wird analysiert/)
    expect(items[1]).toHaveTextContent(/Edeka.*Bitte prüfen/)
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

  it('uploads a valid file and confirms it', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    mockedApi.uploadReceipt.mockResolvedValue(receiptFixture())
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Noch keine Belege')

    const file = jpeg()
    await user.upload(screen.getByLabelText(/Foto oder CSV auswählen/), file)

    await waitFor(() =>
      expect(mockedApi.uploadReceipt).toHaveBeenCalledWith(
        { file, userId: testUser.id },
        expect.anything(),
      ),
    )
    expect(await screen.findByText(/„rewe.jpg“ wurde hochgeladen/)).toBeInTheDocument()
    expect(mockedApi.fetchReceipts).toHaveBeenCalledTimes(2) // list refetched
  })

  it('rejects unsupported files without uploading', async () => {
    mockedApi.fetchReceipts.mockResolvedValue([])
    const user = userEvent.setup({ applyAccept: false })
    renderPage()
    await screen.findByText('Noch keine Belege')

    await user.upload(
      screen.getByLabelText(/Foto oder CSV auswählen/),
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

    await user.upload(screen.getByLabelText(/Foto oder CSV auswählen/), jpeg())

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
})
