import { expect, test } from '@playwright/test';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { loginAs, USERS } from './support/session';

test('gruppo nuovo, spesa di gruppo e saldo del gruppo', async ({ page }) => {
  await loginAs(page, USERS.gastone);
  await page.goto('/tabs/groups');

  // FAB → modale "Nuovo gruppo" con Archimede come membro
  await page.getByRole('button', { name: t('groups.new-group') }).click();
  await topModal(page).getByRole('textbox', { name: t('groups.name-label') }).fill('Gita a Paperopoli');
  await topModal(page).getByRole('button', { name: t('groups.add-member') }).click();
  await topModal(page).getByPlaceholder(t('select-participant.search-placeholder')).fill('Archimede');
  await topModal(page).getByRole('button', { name: 'Archimede', exact: true }).click();
  await topModal(page).getByRole('button', { name: t('groups.create') }).click();
  await expect(toast(page, t('groups.created'))).toBeVisible();

  // Dettaglio del gruppo, segmento Spese vuoto
  await visible(page.getByText('Gita a Paperopoli')).click();
  await expect(page).toHaveURL(/\/tabs\/groups\/[0-9a-f-]{36}$/);
  await visible(page.getByRole('button', { name: t('groups.add-first-expense') })).click();

  // La form arriva con il gruppo già scelto: 2 persone
  await expect(topModal(page).getByText('Gita a Paperopoli · 2')).toBeVisible();
  await topModal(page).getByRole('textbox', { name: t('expense-form.amount') }).fill('50');
  await topModal(page)
    .getByRole('textbox', { name: t('expense-form.description-label') })
    .fill('Albergo');
  await topModal(page).getByRole('button', { name: t('expense-form.save') }).click();
  await expect(toast(page, t('expense-form.created'))).toBeVisible();
  await expect(visible(page.getByText('Albergo'))).toBeVisible();

  // Segmento Saldi: Archimede deve metà
  await visible(page.locator('ion-segment-button[value="balances"]')).click();
  await expect(
    visible(page.locator('ion-item').filter({ hasText: t('balances.owes-you', { name: 'Archimede' }) })),
  ).toContainText('25.00 EUR');
});
