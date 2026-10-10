import { expect, test, type Page } from '@playwright/test';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { apiLogin, createExpense, createGroup, loginAs, USERS } from './support/session';

// Lista della modale con quell'intestazione (Ora / Dopo / Spese da creare).
function modalSection(page: Page, key: string) {
  return topModal(page)
    .locator('ion-list')
    .filter({ has: page.locator('ion-list-header').filter({ hasText: t(key) }) });
}

test('divisione intelligente: "Quo deve a Qua, Qua deve ad Amelia" diventa "Quo deve ad Amelia"', async ({ page }) => {
  // Dati di partenza via API: un gruppo di tre, due spese da 20 € a catena
  const qua = await apiLogin(page.request, USERS.qua);
  const amelia = await apiLogin(page.request, USERS.amelia);
  const quo = await loginAs(page, USERS.quo);
  const ids = { quo: quo.user.publicId, qua: qua.user.publicId, amelia: amelia.user.publicId };
  const group = await createGroup(page.request, quo, 'Campeggio', [ids.qua, ids.amelia]);
  const shares = (who: keyof typeof ids) =>
    Object.values(ids).map((id) => ({ userPublicId: id, share: id === ids[who] ? 20 : 0 }));
  await createExpense(page.request, quo, {
    amount: 20,
    description: 'Tenda',
    groupPublicId: group.publicId,
    paidByPublicId: ids.qua,
    shares: shares('quo'),
  });
  await createExpense(page.request, quo, {
    amount: 20,
    description: 'Legna',
    groupPublicId: group.publicId,
    paidByPublicId: ids.amelia,
    shares: shares('qua'),
  });

  // Saldi del gruppo, dal punto di vista di Quo: deve 20 a Qua
  await page.goto(`/tabs/groups/${group.publicId}`);
  await visible(page.locator('ion-segment-button[value="balances"]')).click();
  const quaRow = visible(page.locator('ion-item').filter({ hasText: t('balances.you-owe', { name: 'QuaQua' }) }));
  await expect(quaRow).toContainText('20.00 EUR');

  // Anteprima: 2 debiti → 1 pagamento (Quo → Amelia), 3 spese di compensazione
  await visible(page.getByRole('button', { name: t('smart-split.button') })).click();
  await expect(modalSection(page, 'smart-split.now').locator('ion-item')).toHaveCount(2);
  const after = modalSection(page, 'smart-split.after').locator('ion-item');
  await expect(after).toHaveCount(1);
  await expect(after).toContainText(t('smart-split.debt', { from: t('smart-split.you'), to: 'Amelia' }));
  await expect(after).toContainText('20.00 EUR');
  await expect(modalSection(page, 'smart-split.expenses-title').locator('ion-item')).toHaveCount(3);
  await topModal(page).getByRole('button', { name: t('smart-split.apply') }).click();
  await expect(toast(page, t('smart-split.applied'))).toBeVisible();

  // Saldi aggiornati: Quo deve 20 ad Amelia e niente a Qua
  await expect(
    visible(page.locator('ion-item').filter({ hasText: t('balances.you-owe', { name: 'Amelia' }) })),
  ).toContainText('20.00 EUR');
  await expect(quaRow).toHaveCount(0);

  // Rilanciata, non trova piu' niente da semplificare
  await visible(page.getByRole('button', { name: t('smart-split.button') })).click();
  await expect(topModal(page).getByText(t('smart-split.nothing-title'))).toBeVisible();
  await expect(topModal(page).getByRole('button', { name: t('smart-split.apply') })).toBeDisabled();
  await topModal(page).getByRole('button', { name: t('smart-split.cancel') }).click();

  // Lista spese: le 3 nuove non hanno descrizione, il titolo e' la categoria tradotta
  await visible(page.locator('ion-segment-button[value="expenses"]')).click();
  const smartTitles = visible(page.getByRole('heading', { name: t('categories.smart-split'), exact: true }));
  await expect(smartTitles).toHaveCount(3);

  // Dettaglio: si puo' eliminare ma non modificare
  await smartTitles.first().click();
  await expect(visible(page.getByRole('button', { name: t('expense-detail.delete') }))).toBeVisible();
  await expect(visible(page.getByRole('button', { name: t('expense-detail.edit') }))).toHaveCount(0);

  // Activity elenca solo le spese vere: quelle di compensazione no
  await page.goto('/tabs/activity');
  await expect(visible(page.getByRole('heading', { name: 'Tenda' }))).toBeVisible();
  await expect(visible(page.getByRole('heading', { name: t('categories.smart-split'), exact: true }))).toHaveCount(0);
});
