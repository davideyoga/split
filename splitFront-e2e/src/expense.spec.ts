import { expect, test } from '@playwright/test';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { loginAs, USERS } from './support/session';

test('nuova spesa divisa in parti uguali, dettaglio ed eliminazione', async ({ page }) => {
  await loginAs(page, USERS.pippo);
  await page.goto('/tabs/activity');

  // FAB → modale "Nuova spesa"
  await page.getByRole('button', { name: t('expense-form.title-new') }).click();
  await topModal(page).getByRole('textbox', { name: t('expense-form.amount') }).fill('30');
  await topModal(page)
    .getByRole('textbox', { name: t('expense-form.description-label') })
    .fill('Cena al lago');

  // "Dividi con" → modale di scelta (sopra la form) → Pluto
  await topModal(page).getByRole('button', { name: t('expense-form.split-with') }).click();
  await topModal(page).getByPlaceholder(t('select-participant.search-placeholder')).fill('Plut');
  await topModal(page).getByRole('button', { name: 'Pluto', exact: true }).click();

  // Tornati alla form: 30 € in due
  await expect(
    topModal(page).getByText(t('expense-form.split-each', { amount: '15.00' })),
  ).toBeVisible();
  await topModal(page).getByRole('button', { name: t('expense-form.save') }).click();
  await expect(toast(page, t('expense-form.created'))).toBeVisible();

  // La spesa è in cima ad Activity; il dettaglio mostra le quote
  await visible(page.getByText('Cena al lago')).click();
  await expect(page).toHaveURL(/\/tabs\/activity\/expense\/[0-9a-f-]{36}$/);
  // Per ruolo, non per testo: durante la transizione Activity (che mostra
  // anch'essa "30.00 EUR") è ancora visibile sotto il dettaglio.
  await expect(page.getByRole('heading', { name: '30.00 EUR' })).toBeVisible();
  await expect(
    visible(page.locator('ion-item').filter({ hasText: 'Pluto' })),
  ).toContainText('15.00 EUR');

  // Elimina, con conferma
  await page.getByRole('button', { name: t('expense-detail.delete') }).click();
  await page
    .locator('ion-alert')
    .getByRole('button', { name: t('expense-detail.delete') })
    .click();
  await expect(toast(page, t('expense-detail.deleted'))).toBeVisible();
  await expect(page).toHaveURL(/\/tabs\/activity$/);
  await expect(visible(page.getByText(t('activity.empty-title')))).toBeVisible();
});
