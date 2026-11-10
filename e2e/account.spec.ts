import path from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { settleAnimations, signInAsDemo, signInWithMagicLink, uniqueEmail } from './helpers.ts'

async function expectNoSeriousViolations(page: Page) {
  await settleAnimations(page)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

test('account: profile, usage, name, and a complete deletion', async ({ page }) => {
  const email = uniqueEmail('account')
  await signInWithMagicLink(page, email)

  // One receipt, so there is something to delete (mock provider).
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('button', { name: 'Beleg hochladen' })
    .click({ trial: true })
  await page
    .getByTestId('upload-input')
    .setInputFiles(path.join(import.meta.dirname, 'fixtures/receipt.jpg'))
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]+$/)
  await expect(page.getByRole('dialog').getByRole('heading', { name: /deinen Blick/ })).toBeVisible(
    {
      timeout: 20_000,
    },
  )
  await page.keyboard.press('Escape')

  // Avatar menu → account page.
  await page.getByRole('button', { name: /Konto-Menü/ }).click()
  await expect(page.getByRole('menu')).toContainText(email)
  await page.getByRole('menuitem', { name: 'Konto' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible()

  await expect(
    page.getByText('Belege insgesamt', { exact: true }).locator('xpath=following-sibling::dd'),
  ).toHaveText('1')
  await expect(page.getByText('1 von 20')).toBeVisible()
  await expectNoSeriousViolations(page)

  // Name: saved, and shown as the initials in the avatar.
  await page.getByLabel('Name (optional)').fill('Erika Muster')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Gespeichert.')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Konto-Menü, angemeldet als Erika Muster/ }),
  ).toContainText('EM')

  // Deleting needs the confirmation word and ends on the login page.
  await page.getByRole('button', { name: /Konto löschen …/ }).click()
  const dialog = page.getByRole('alertdialog')
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Tippe „löschen“/).fill('löschen')
  await confirm.click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()

  // The account is really gone: the same address starts over with an empty account.
  await signInWithMagicLink(page, email)
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Belege' })
    .click()
  await expect(page.getByText('Noch keine Belege')).toBeVisible()
})

test('the shared demo account cannot be changed or deleted', async ({ page }) => {
  await signInAsDemo(page)
  await page.getByRole('button', { name: /Konto-Menü/ }).click()
  await page.getByRole('menuitem', { name: 'Konto' }).click()
  await expect(page.getByText('Das ist das gemeinsame Demo-Konto')).toBeVisible()
  await expect(page.getByRole('button', { name: /Konto löschen …/ })).toBeDisabled()
  await expect(page.getByLabel('Name (optional)')).toBeDisabled()
})

test('legal pages are public and accessible', async ({ page }) => {
  for (const [route, heading] of [
    ['/impressum', 'Impressum'],
    ['/datenschutz', 'Datenschutz'],
  ] as const) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expectNoSeriousViolations(page)
  }
})

test('the header fits a phone: upload and account stay on screen', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 800 })
  await signInAsDemo(page)
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  for (const control of [
    nav.getByRole('button', { name: 'Beleg hochladen' }),
    page.getByRole('button', { name: /Konto-Menü/ }),
  ]) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(412)
  }
  expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(412)
})
