import { expect, test } from '@playwright/test';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { loginAs, USERS } from './support/session';

test('divisione non uniforme: "io 10, il resto a Paperone" e saldo coerente', async ({ page }) => {
  await loginAs(page, USERS.topolino);
  await page.goto('/tabs/activity');

  await page.getByRole('button', { name: t('expense-form.title-new') }).click();
  await topModal(page).getByRole('textbox', { name: t('expense-form.amount') }).fill('30');
  await topModal(page)
    .getByRole('textbox', { name: t('expense-form.description-label') })
    .fill('Benzina');
  await topModal(page).getByRole('button', { name: t('expense-form.split-with') }).click();
  await topModal(page).getByPlaceholder(t('select-participant.search-placeholder')).fill('Paperone');
  await topModal(page).getByRole('button', { name: 'Paperone', exact: true }).click();

  // La riga "Divisione" mostra "Equal · 15.00 each": aprirla apre SplitSharesModal
  await topModal(page).getByRole('button', { name: t('expense-form.split-equal') }).click();
  const done = topModal(page).getByRole('button', { name: t('split-shares.done') });

  await topModal(page).getByRole('textbox', { name: 'Topolino' }).fill('10');
  await topModal(page).getByRole('textbox', { name: 'Paperone' }).fill('');
  await expect(done).toBeDisabled(); // 10 su 30: mancano 20

  // "+20.00" sulla riga di Paperone gli assegna quel che manca
  await topModal(page)
    .locator('ion-item')
    .filter({ hasText: 'Paperone' })
    .getByRole('button', { name: '+20.00' })
    .click();
  await expect(topModal(page).getByRole('textbox', { name: 'Paperone' })).toHaveValue('20.00');
  await expect(done).toBeEnabled();
  await done.click();

  // Form in modalità "Personalizzata", salvataggio
  await expect(topModal(page).getByText(t('expense-form.split-custom'))).toBeVisible();
  await topModal(page).getByRole('button', { name: t('expense-form.save') }).click();
  await expect(toast(page, t('expense-form.created'))).toBeVisible();

  // Saldi: Paperone deve a Topolino la sua quota (20), non metà (15)
  await page.locator('ion-tab-button[tab="balances"]').click();
  await expect(
    visible(page.locator('ion-item').filter({ hasText: t('balances.owes-you', { name: 'Paperone' }) })),
  ).toContainText('20.00 EUR');
});
