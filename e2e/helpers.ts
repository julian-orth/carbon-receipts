import { expect, type Page } from '@playwright/test'

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

export const demo = { email: 'demo@carbon-receipts.app', password: 'demo-carbon-receipts' }

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

type MailpitSearch = { messages: Array<{ ID: string }> }
type MailpitMessage = { Text: string }

/** Polls Mailpit for the magic link sent to `email`. */
export async function fetchMagicLink(email: string): Promise<string> {
  let link: string | undefined
  await expect
    .poll(
      async () => {
        const search = (await (
          await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
        ).json()) as MailpitSearch
        const id = search.messages[0]?.ID
        if (!id) return undefined
        const message = (await (
          await fetch(`${MAILPIT}/api/v1/message/${id}`)
        ).json()) as MailpitMessage
        link = /https?:\/\/\S+\/auth\/v1\/verify\S+/.exec(message.Text)?.[0]
        return link
      },
      { message: `magic link for ${email}`, timeout: 15_000 },
    )
    .toBeTruthy()
  return link ?? ''
}

export async function signInWithMagicLink(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByRole('button', { name: 'Login-Link senden' }).click()
  await expect(page.getByRole('heading', { name: 'Prüfe dein Postfach' })).toBeVisible()
  // Same browser context → the PKCE verifier is in localStorage.
  await page.goto(await fetchMagicLink(email))
  await expect(page.getByRole('heading', { level: 1, name: 'Übersicht' })).toBeVisible()
}

export async function signInAsDemo(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Demo ansehen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Übersicht' })).toBeVisible()
}
