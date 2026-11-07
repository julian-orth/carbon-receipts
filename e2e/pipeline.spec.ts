import path from 'node:path'
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
  await expect(page.getByText(/wurde hochgeladen und wird analysiert/)).toBeVisible()

  // Status arrives via Realtime – no reload.
  const item = page.getByRole('listitem').filter({ hasText: 'Beispielmarkt' })
  await expect(item.getByText('Bitte prüfen')).toBeVisible({ timeout: 20_000 })
  await item.getByRole('link', { name: 'Prüfen' }).click()

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
