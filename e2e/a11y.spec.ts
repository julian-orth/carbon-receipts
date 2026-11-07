import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { signInAsDemo } from './helpers.ts'

async function expectNoSeriousViolations(page: Page) {
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

test('login page', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
  await expectNoSeriousViolations(page)
})

test('dashboard, receipts and review', async ({ page }) => {
  await signInAsDemo(page)
  await expect(page.getByRole('region', { name: 'Verlauf' })).toBeVisible()
  await expectNoSeriousViolations(page)

  await page.getByRole('link', { name: 'Belege' }).click()
  await expect(page.getByRole('list', { name: 'Deine Belege' })).toBeVisible()
  await expectNoSeriousViolations(page)

  await page.getByRole('link', { name: 'Prüfen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Wochenmarkt' })).toBeVisible()
  await expectNoSeriousViolations(page)
})
