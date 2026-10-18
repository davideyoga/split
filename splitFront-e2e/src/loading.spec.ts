import { expect, test } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { visible } from './support/ionic';
import { createExpense, loginAs, USERS } from './support/session';

test('con poca rete: logo all\'avvio, poi lo scheletro finché non arrivano le spese', async ({ page }) => {
  const orazio = await loginAs(page, USERS.orazio);
  await createExpense(page.request, orazio, { amount: 12, description: 'Caffè' });

  // Rete lenta simulata: le spese arrivano solo quando lo decide il test.
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(`${API_URL}/expense`, async (route) => {
    await released;
    await route.continue();
  });

  await page.goto('/tabs/activity');

  // Pagina e traduzioni pronte: via il logo dell'avvio, dentro lo scheletro.
  const skeleton = visible(page.getByRole('status').filter({ hasText: t('common.loading') }));
  await expect(skeleton).toBeVisible();
  await expect(page.locator('#boot-splash')).toHaveCount(0);
  await expect(visible(page.getByText(t('activity.empty-title')))).toHaveCount(0);

  release();
  await expect(visible(page.locator('app-expense-list'))).toContainText('Caffè');
  await expect(skeleton).toHaveCount(0);
});
