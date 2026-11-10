import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { settleAnimations, signInAsDemo } from './helpers.ts'

test('data basis page shows every emission factor of the database', async ({ page }) => {
  // The dashboard already loads (and caches) the factors, so listen before the first page.
  const response = page.waitForResponse((r) => r.url().includes('/rest/v1/emission_categories'))
  await signInAsDemo(page)
  await page.getByRole('link', { name: 'Datenbasis' }).click()
  // `content-range: 0-74/75` – the server's own total, not a number baked into the test.
  const total = Number(
    /\/(\d+)$/.exec((await (await response).headerValue('content-range')) ?? '')?.[1],
  )
  expect(total).toBeGreaterThanOrEqual(60)

  await expect(page.getByRole('heading', { level: 1, name: 'Datenbasis' })).toBeVisible()
  const all = page.getByRole('region', { name: 'Alle Faktoren' })
  await expect(all.getByRole('listitem')).toHaveCount(total)
  await expect(all.getByRole('link', { name: /ifeu 2020/ })).not.toHaveCount(0)
  // Every row carries a source link.
  await expect(all.getByRole('listitem').getByRole('link')).toHaveCount(total)

  await page.getByRole('searchbox', { name: 'Faktoren durchsuchen' }).fill('Diesel')
  await expect(all.getByRole('listitem')).toHaveCount(1)

  await settleAnimations(page)

  const serious = (
    await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  ).violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any.map((a) => a.message).join('|')}`).join(', ')}`,
    ),
  ).toEqual([])
})
