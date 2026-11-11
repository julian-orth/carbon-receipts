import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import * as accountApi from '@/features/account/api'
import * as dashboardApi from '@/features/dashboard/api'
import * as categoriesApi from '@/features/categories/api'
import { supabase } from '@/lib/supabase'
import { authenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'

vi.mock('@/features/account/api')
vi.mock('@/features/dashboard/api')
vi.mock('@/features/categories/api')
vi.mock('@/features/receipts/api')

const signOut = vi.spyOn(supabase.auth, 'signOut')

function renderApp() {
  return renderRoutes(routes, { initialPath: '/datenbasis', auth: authenticated })
}

describe('UserMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue([])
    vi.mocked(dashboardApi.fetchMonthlyTotals).mockResolvedValue([])
    vi.mocked(accountApi.fetchProfile).mockResolvedValue({
      display_name: 'Julian Orth',
      daily_ai_quota: 20,
      created_at: '2026-01-01T00:00:00Z',
    })
    vi.mocked(accountApi.fetchAiUsageToday).mockResolvedValue(3)
    signOut.mockResolvedValue({ error: null })
  })

  it('shows the initials and names the account for screen readers', async () => {
    renderApp()
    const trigger = await screen.findByRole('button', {
      name: 'Konto-Menü, angemeldet als Julian Orth',
    })
    await waitFor(() => expect(trigger).toHaveTextContent('JO'))
  })

  it('falls back to the e-mail initial without a name', async () => {
    vi.mocked(accountApi.fetchProfile).mockResolvedValue(null)
    renderApp()
    const trigger = await screen.findByRole('button', { name: /Konto-Menü/ })
    expect(trigger).toHaveTextContent('A')
  })

  it('offers the account page, the appearance and sign-out', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /Konto-Menü/ }))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('alice@example.com')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Konto' })).toHaveAttribute('href', '/konto')
    expect(within(menu).getByRole('menuitemradio', { name: 'Wie das System' })).toBeChecked()
    expect(within(menu).getByRole('menuitem', { name: 'Abmelden' })).toBeInTheDocument()
  })

  it('switches the theme from the menu', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /Konto-Menü/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dunkel' }))
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
    localStorage.removeItem('theme')
    document.documentElement.classList.remove('dark')
  })

  it('shows the remaining AI analyses in the header and links to the account', async () => {
    renderApp()
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    const badge = await within(nav).findByRole('link', {
      name: 'Noch 17 von 20 KI-Analysen heute. Zum Konto.',
    })
    expect(badge).toHaveAttribute('href', '/konto')
    expect(badge).toHaveTextContent('17/20')
  })

  it('says so when the daily limit is reached', async () => {
    vi.mocked(accountApi.fetchAiUsageToday).mockResolvedValue(20)
    renderApp()
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    expect(
      await within(nav).findByRole('link', {
        name: 'Tageslimit erreicht: 20 von 20 KI-Analysen genutzt. Zum Konto.',
      }),
    ).toBeInTheDocument()
  })

  it('hides the badge when the usage cannot be read', async () => {
    vi.mocked(accountApi.fetchAiUsageToday).mockRejectedValue(new Error('offline'))
    renderApp()
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    await within(nav).findByRole('button', { name: /Konto-Menü/ })
    expect(within(nav).queryByRole('link', { name: /KI-Analysen/ })).not.toBeInTheDocument()
  })

  it('signs out', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: /Konto-Menü/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Abmelden' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('has the upload button in the header on every page', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click')
    const user = userEvent.setup()
    renderApp()
    const nav = await screen.findByRole('navigation', { name: 'Hauptnavigation' })
    await user.click(within(nav).getByRole('button', { name: 'Beleg hochladen' }))
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })
})
