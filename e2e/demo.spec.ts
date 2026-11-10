import { expect, test } from '@playwright/test'
import { signInAsDemo } from './helpers.ts'

test('demo: dashboard shows trend, goal, hotspots and alternatives', async ({ page }) => {
  await signInAsDemo(page)

  const trend = page.getByRole('region', { name: 'Verlauf' })
  await expect(trend).toBeVisible()
  await trend.getByText('Als Tabelle anzeigen').click()
  await expect(trend.getByRole('table', { name: 'CO₂e pro Monat' }).getByRole('row')).toHaveCount(7)

  await expect(
    page.getByRole('region', { name: 'Monatsziel' }).getByText('Ziel: 45 kg CO₂e'),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Hotspots' }).getByRole('listitem').first(),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Sparpotenzial' }).getByText('Quelle:').first(),
  ).toBeVisible()

  await page.getByRole('button', { name: '3 Monate' }).click()
  await expect(page.getByRole('button', { name: '3 Monate' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('demo: the receipt waiting for review flags uncertain items', async ({ page }) => {
  await signInAsDemo(page)
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Belege' })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Wochenmarkt' })
    .getByRole('link', { name: 'Prüfen' })
    .click()

  await expect(page.getByRole('heading', { level: 1, name: 'Wochenmarkt' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Zu prüfen\s*2$/ })).toBeVisible()
  const salmon = page.getByRole('form', { name: 'Wildlachs geräuchert' })
  await expect(salmon.getByText('Kein CO₂-Wert: Menge fehlt')).toBeVisible()

  // Live preview only – the demo data is shared, so nothing is saved here.
  await salmon.getByLabel('Menge').fill('0,1')
  await salmon.getByRole('radio', { name: 'kg', exact: true }).check({ force: true })
  await expect(salmon.getByText('400 g CO₂e')).toBeVisible()
})
