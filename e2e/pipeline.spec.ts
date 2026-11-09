import path from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { signInWithMagicLink, uniqueEmail } from './helpers.ts'

// Needs `npm run functions:serve` with LLM_PROVIDERS=mock (deterministic receipt).
test('magic link → upload → AI extraction → review → dashboard', async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail('e2e'))

  await page.getByRole('link', { name: 'Belege' }).click()
  await expect(page.getByText('Noch keine Belege')).toBeVisible()

  await page
    .getByLabel(/Foto auswählen/)
    .setInputFiles(path.join(import.meta.dirname, 'fixtures/receipt.jpg'))

  // Live view: every step is shown, the result is printed, then on to the review.
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]+\/live$/)
  await expect(page.getByRole('navigation', { name: 'Verarbeitungsschritte' })).toBeVisible()
  const review = page.getByRole('link', { name: /Beleg prüfen/ })
  await expect(review).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('list', { name: 'Erkannte Positionen' })).toContainText('Gouda')
  // The mock receipt has an item without amount, so it asks for a look.
  await expect(page.getByRole('log')).toContainText(/deinen Blick/)
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])
  await review.click()

  await expect(page.getByRole('heading', { level: 1, name: 'Beispielmarkt' })).toBeVisible()
  const gouda = page.getByRole('form', { name: 'Gouda jung Scheiben' })
  await gouda.getByLabel('Menge').fill('0,2')
  await gouda.getByLabel('Einheit').selectOption('kg')
  await expect(gouda.getByText('1,14 kg CO₂e')).toBeVisible()
  await gouda.getByRole('button', { name: 'Speichern' }).click()
  await expect(gouda.getByText('Geprüft')).toBeVisible()

  await page.getByRole('button', { name: 'Beleg bestätigen' }).click()
  await expect(page.getByText('Beleg bestätigt')).toBeVisible()

  await page.getByRole('link', { name: 'Übersicht', exact: true }).first().click()
  // 4.6 + 1.4 + 0.72 + 0.3 (mock items) + 1.14 (corrected) = 8.16 kg
  await expect(page.getByText('Dieser Monat (laufend)').locator('..')).toContainText('8,16 kg CO₂e')
})
