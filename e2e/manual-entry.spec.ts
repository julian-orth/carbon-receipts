import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { settleAnimations, signInWithMagicLink, uniqueEmail } from './helpers.ts'

/** A receipt typed in by hand: merchant, date and one oat drink. Returns once it is in review. */
async function enterReceipt(page: Page, merchant: string) {
  await page.goto('/receipts')
  await page.getByRole('button', { name: 'Von Hand erfassen' }).click()
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]+$/)

  await page.getByRole('button', { name: 'Händler und Datum ändern' }).click()
  const details = page.getByRole('form', { name: 'Händler und Datum ändern' })
  await details.getByLabel('Händler').fill(merchant)
  await details.getByLabel('Einkaufsdatum').fill('2026-11-03')
  await details.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('heading', { level: 1, name: merchant })).toBeVisible()

  const form = page.getByRole('form', { name: 'Position hinzufügen' })
  await form.getByLabel('Name auf dem Bon').fill('Haferdrink')
  await form.getByRole('button', { name: /Kategorie/ }).click()
  await page.getByRole('combobox', { name: 'Kategorie suchen' }).fill('hafer')
  await page.keyboard.press('Enter')
  await form.getByLabel('Menge').fill('1')
  await form.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByRole('button', { name: /Haferdrink/ })).toBeVisible()
}

test('manual entry, duplicate warning and coverage', async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail('manual'))

  await enterReceipt(page, 'Testmarkt')
  // Nothing to compare with yet, and the page is accessible.
  await expect(page.getByLabel('Möglicherweise doppelter Beleg')).toHaveCount(0)
  await settleAnimations(page)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => v.id),
  ).toEqual([])

  await page.getByRole('button', { name: 'Beleg bestätigen' }).click()
  await expect(page.getByText('Beleg bestätigt')).toBeVisible()

  // The same receipt again: warned, and it can be thrown away right there.
  await enterReceipt(page, 'Testmarkt')
  const notice = page.getByLabel('Möglicherweise doppelter Beleg')
  await expect(notice).toContainText('Testmarkt am 03.11.2026 mit 1 Position')
  await notice.getByRole('button', { name: 'Diesen Beleg löschen' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(page).toHaveURL(/\/receipts$/)

  // Coverage on the dashboard: the one confirmed item has a value.
  await page.goto('/')
  const coverage = page.getByRole('region', { name: 'Abdeckung' })
  await expect(coverage).toContainText('1 von 1 Positionen sind berechnet')
})
