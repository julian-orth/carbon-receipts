import path from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { signInWithMagicLink, uniqueEmail } from './helpers.ts'

// Needs `npm run functions:serve` with LLM_PROVIDERS=mock (deterministic receipt).
test('magic link → upload → AI extraction → review → dashboard', async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail('e2e'))

  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Belege' })
    .click()
  await expect(page.getByText('Noch keine Belege')).toBeVisible()

  await page
    .getByLabel(/Foto auswählen/)
    .setInputFiles(path.join(import.meta.dirname, 'fixtures/receipt.jpg'))

  // The receipt page opens with the analysis in a dialog: every step, then the result.
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]+$/)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('list', { name: 'Verarbeitungsschritte' })).toBeVisible()
  // The mock receipt has an item without amount, so it asks for a look.
  await expect(dialog.getByRole('heading', { name: /deinen Blick/ })).toBeVisible({
    timeout: 20_000,
  })
  const dialogAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(dialogAxe.violations.map((v) => v.id)).toEqual([])
  await dialog.getByRole('button', { name: /Positionen prüfen/ }).click()
  await expect(dialog).toBeHidden()

  // Same page, now the review: lines in receipt order, one editor open at a time.
  await expect(page.getByRole('heading', { level: 1, name: 'Beispielmarkt' })).toBeVisible()
  const goudaToggle = page.getByRole('button', { name: /Gouda jung Scheiben/ })
  if ((await goudaToggle.getAttribute('aria-expanded')) !== 'true') await goudaToggle.click()
  const gouda = page.getByRole('form', { name: 'Gouda jung Scheiben' })
  await gouda.getByLabel('Menge').fill('0,2')
  await gouda.locator('label', { hasText: /^kg$/ }).click()
  await expect(gouda.getByRole('radio', { name: 'kg', exact: true })).toBeChecked()
  await expect(gouda.getByText('1,14 kg CO₂e')).toBeVisible()
  const reviewAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(reviewAxe.violations.map((v) => v.id)).toEqual([])
  await gouda.getByRole('button', { name: /Speichern/ }).click()
  await expect(goudaToggle).toContainText('Geprüft')

  await page.getByRole('button', { name: 'Beleg bestätigen' }).click()
  await expect(page.getByText('Beleg bestätigt')).toBeVisible()

  await page.getByRole('link', { name: 'Übersicht', exact: true }).first().click()
  // 4.6 + 1.4 + 0.72 + 0.3 (mock items) + 1.14 (corrected) = 8.16 kg
  await expect(page.getByText('Summe, 6 Monate').locator('..')).toContainText('8,16 kg CO₂e')
})
