import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import type { AuthState } from '@/features/auth/auth-context'
import * as receiptsApi from '@/features/receipts/api'
import { receiptFixture } from '@/features/receipts/test-fixtures'
import { authenticated, testSession, testUser } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import * as api from './api'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  fetchProfile: vi.fn<typeof api.fetchProfile>(),
  fetchAiUsageToday: vi.fn<typeof api.fetchAiUsageToday>(),
  updateDisplayName: vi.fn<typeof api.updateDisplayName>(),
  fetchExport: vi.fn<typeof api.fetchExport>(),
  deleteAccount: vi.fn<typeof api.deleteAccount>(),
}))
vi.mock('@/features/receipts/api')

const mocked = vi.mocked(api)
const receipts = vi.mocked(receiptsApi)

function renderAccount(auth: AuthState = authenticated) {
  return renderRoutes(routes, { initialPath: '/konto', auth })
}

/** Value (dd) next to its label (dt). */
const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Konto löschen …/ }))
  return screen.findByRole('alertdialog')
}

describe('AccountPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocked.fetchProfile.mockResolvedValue({
      display_name: 'Alice',
      daily_ai_quota: 20,
      created_at: '2026-01-15T10:00:00Z',
    })
    mocked.fetchAiUsageToday.mockResolvedValue(5)
    receipts.fetchReceipts.mockResolvedValue([
      receiptFixture({ id: 'a', status: 'done' }),
      receiptFixture({ id: 'b', status: 'review' }),
      receiptFixture({ id: 'c', status: 'failed', error: 'x' }),
    ])
    receipts.fetchReceiptTotals.mockResolvedValue(new Map([['a', { itemCount: 6, co2eKg: 12.5 }]]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the profile', async () => {
    renderAccount()
    expect(await screen.findByRole('heading', { level: 1, name: 'Konto' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Name (optional)')).toHaveValue('Alice')
    expect(screen.getByText('alice@example.com', { selector: 'dd' })).toBeInTheDocument()
    expect(stat('Dabei seit')).toHaveTextContent('15.01.2026')
  })

  it('counts receipts and sums only the confirmed ones', async () => {
    renderAccount()
    await screen.findByText('Belege insgesamt')
    expect(stat('Belege insgesamt')).toHaveTextContent('3')
    expect(stat('Bestätigt')).toHaveTextContent('1')
    expect(stat('CO₂e aus bestätigten Belegen')).toHaveTextContent('12,5 kg CO₂e')
    expect(stat('Erfasste Produkte')).toHaveTextContent('6')
    expect(stat('Warten auf deine Prüfung')).toHaveTextContent('1')
    expect(stat('Fehlgeschlagen')).toHaveTextContent('1')
  })

  it('shows today’s analyses against the daily limit', async () => {
    renderAccount()
    expect(await screen.findByText('5 von 20')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'KI-Analysen heute' })).toHaveAttribute(
      'value',
      '5',
    )
    expect(screen.getByText(/Noch 15 Analysen heute/)).toBeInTheDocument()
  })

  it('says so when the daily limit is used up', async () => {
    mocked.fetchAiUsageToday.mockResolvedValue(20)
    renderAccount()
    expect(
      await screen.findByText('Das Tageslimit ist erreicht. Morgen geht es weiter.'),
    ).toBeVisible()
  })

  it('invites to the first upload without receipts', async () => {
    receipts.fetchReceipts.mockResolvedValue([])
    renderAccount()
    expect(await screen.findByText(/Noch keine Belege\. Lade deinen ersten/)).toBeInTheDocument()
  })

  it('saves a changed name', async () => {
    mocked.updateDisplayName.mockResolvedValue()
    const user = userEvent.setup()
    renderAccount()
    const input = await screen.findByLabelText('Name (optional)')
    const save = screen.getByRole('button', { name: 'Speichern' })
    expect(save).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'Alice B.')
    await user.click(save)

    expect(mocked.updateDisplayName).toHaveBeenCalledWith(testUser.id, 'Alice B.')
  })

  it('refuses a name that is too long', async () => {
    const user = userEvent.setup()
    renderAccount()
    const input = await screen.findByLabelText('Name (optional)')
    await user.clear(input)
    await user.click(input)
    await user.paste('x'.repeat(81))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Der Name darf höchstens 80 Zeichen haben.')).toBeVisible()
    expect(mocked.updateDisplayName).not.toHaveBeenCalled()
  })

  it('downloads the data as a file', async () => {
    mocked.fetchExport.mockResolvedValue({
      exported_at: '2026-11-10T12:00:00.000Z',
      account: { email: 'alice@example.com', display_name: 'Alice', created_at: null },
      receipts: [],
      line_items: [],
      goals: [],
    })
    URL.createObjectURL = vi.fn<typeof URL.createObjectURL>(() => 'blob:x')
    URL.revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const user = userEvent.setup()
    renderAccount()

    await user.click(await screen.findByRole('button', { name: 'Meine Daten herunterladen' }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(mocked.fetchExport).toHaveBeenCalledWith('alice@example.com')
  })

  it('reports a failed download', async () => {
    mocked.fetchExport.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderAccount()
    await user.click(await screen.findByRole('button', { name: 'Meine Daten herunterladen' }))
    expect(await screen.findByText(/Der Download hat nicht geklappt/)).toBeVisible()
  })

  describe('deleting the account', () => {
    it('needs the confirmation word first', async () => {
      mocked.deleteAccount.mockResolvedValue()
      const user = userEvent.setup()
      renderAccount()
      const dialog = await openDialog(user)
      const confirm = within(dialog).getByRole('button', { name: 'Endgültig löschen' })
      expect(confirm).toBeDisabled()

      await user.type(within(dialog).getByLabelText(/Tippe „löschen“/), 'Löschen')
      expect(confirm).toBeEnabled()
      await user.click(confirm)

      expect(mocked.deleteAccount).toHaveBeenCalledTimes(1)
    })

    it('keeps the dialog and the account when it fails', async () => {
      mocked.deleteAccount.mockRejectedValue(new Error('server'))
      const user = userEvent.setup()
      renderAccount()
      const dialog = await openDialog(user)
      await user.type(within(dialog).getByLabelText(/Tippe „löschen“/), 'löschen')
      await user.click(within(dialog).getByRole('button', { name: 'Endgültig löschen' }))

      expect(await within(dialog).findByText(/Dein Konto ist unverändert/)).toBeVisible()
    })

    it('can be cancelled', async () => {
      const user = userEvent.setup()
      renderAccount()
      const dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(mocked.deleteAccount).not.toHaveBeenCalled()
    })
  })

  it('protects the shared demo account', async () => {
    const demoUser = { ...testUser, email: 'demo@example.com' }
    renderAccount({
      status: 'authenticated',
      session: { ...testSession, user: demoUser },
      user: demoUser,
    })
    expect(await screen.findByText('Das ist das gemeinsame Demo-Konto')).toBeVisible()
    expect(screen.getByRole('button', { name: /Konto löschen …/ })).toBeDisabled()
    expect(await screen.findByLabelText('Name (optional)')).toBeDisabled()
  })
})
