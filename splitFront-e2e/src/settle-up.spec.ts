import { expect, test } from '@playwright/test';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { apiLogin, createExpense, loginAs, USERS } from './support/session';

test('rimborso parziale dal tab Saldi, poi eliminato', async ({ page }) => {
  // Dati di partenza via API: Paperino ha pagato 30 € di gelati per sé e Qui
  const qui = await apiLogin(page.request, USERS.qui);
  const paperino = await loginAs(page, USERS.paperino);
  await createExpense(page.request, paperino, {
    amount: 30,
    description: 'Gelati',
    participantPublicIds: [qui.user.publicId],
  });

  await page.goto('/tabs/balances');
  const balanceRow = visible(
    page.locator('ion-item').filter({ hasText: t('balances.owes-you', { name: 'QuiQui' }) }),
  );
  await expect(balanceRow).toContainText('15.00 EUR');

  // "Salda" → modale precompilata con tutto il saldo; Qui ne restituisce 10
  await balanceRow.getByRole('button', { name: t('balances.settle-up') }).click();
  await expect(topModal(page).getByText(t('settlements.they-paid-you', { name: 'QuiQui' }))).toBeVisible();
  const amount = topModal(page).getByRole('textbox', { name: t('settlements.amount') });
  await expect(amount).toHaveValue('15.00');
  await amount.fill('10');
  await topModal(page).getByRole('textbox', { name: t('settlements.note-label') }).fill('contanti');
  await topModal(page).getByRole('button', { name: t('settlements.save') }).click();
  await expect(toast(page, t('settlements.saved'))).toBeVisible();

  // Saldo ridotto a 5 (regex: "15.00 EUR" contiene "5.00 EUR") e rimborso nello storico
  await expect(balanceRow).toContainText(/(?<!\d)5\.00 EUR/);
  const repaymentRow = visible(
    page.locator('ion-item').filter({ hasText: t('settlements.they-paid-you', { name: 'QuiQui' }) }),
  );
  await expect(repaymentRow).toContainText('10.00 EUR');
  await expect(repaymentRow).toContainText('contanti');

  // Eliminato il rimborso, il saldo torna a 15
  await repaymentRow.getByRole('button', { name: t('settlements.delete') }).click();
  await page.locator('ion-alert').getByRole('button', { name: t('settlements.delete') }).click();
  await expect(toast(page, t('settlements.deleted'))).toBeVisible();
  await expect(repaymentRow).toHaveCount(0);
  await expect(balanceRow).toContainText('15.00 EUR');
});
