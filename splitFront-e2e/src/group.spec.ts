import { expect, test } from '@playwright/test';
import { t } from './support/i18n';
import { fillInput, toast, topModal, visible } from './support/ionic';
import { apiLogin, joinGroup, loginAs, USERS } from './support/session';

test('gruppo nuovo, link d\'invito, spesa di gruppo e saldo del gruppo', async ({ page }) => {
  await loginAs(page, USERS.gastone);
  await page.goto('/tabs/groups');

  // FAB → modale "Nuovo gruppo": solo il nome, gli altri entrano col link
  await page.getByRole('button', { name: t('groups.new-group') }).click();
  await topModal(page).getByRole('textbox', { name: t('groups.name-label') }).fill('Gita a Paperopoli');
  await expect(topModal(page).getByText(t('groups.invite-after-create'))).toBeVisible();
  await topModal(page).getByRole('button', { name: t('groups.create') }).click();
  await expect(toast(page, t('groups.created'))).toBeVisible();

  // Il gruppo appena creato si apre sui Membri, dove si crea il link
  await expect(page).toHaveURL(/\/tabs\/groups\/[0-9a-f-]{36}\?segment=members$/);
  await visible(page.getByRole('button', { name: t('invite.create') })).click();
  const link = visible(page.getByRole('textbox', { name: t('invite.link-label') }));
  await expect(link).toHaveValue(/^http:\/\/localhost:4300\/join#[A-Za-z0-9_-]{43}$/);
  const token = (await link.inputValue()).split('#')[1];
  await expect(visible(page.getByRole('button', { name: t('invite.create-new') }))).toBeVisible();

  // Archimede entra col link (il percorso dalla pagina /join e' in invite.spec.ts)
  await joinGroup(page.request, await apiLogin(page.request, USERS.archimede), token);
  await page.reload();
  await expect(visible(page.locator('ion-item').filter({ hasText: 'Archimede' }))).toBeVisible();
  // Il token si vede solo alla creazione: ricaricando resta "link attivo".
  await expect(visible(page.getByRole('button', { name: t('invite.create-new') }))).toBeVisible();
  await expect(page.getByRole('textbox', { name: t('invite.link-label') })).toHaveCount(0);

  // Segmento Spese vuoto
  await visible(page.locator('ion-segment-button[value="expenses"]')).click();
  await visible(page.getByRole('button', { name: t('groups.add-first-expense') })).click();

  // La form arriva con il gruppo già scelto: 2 persone
  await expect(topModal(page).getByText('Gita a Paperopoli · 2')).toBeVisible();
  await topModal(page).getByRole('textbox', { name: t('expense-form.amount') }).fill('50');
  await fillInput(topModal(page).getByRole('textbox', { name: t('expense-form.description-label') }), 'Albergo');
  await topModal(page).getByRole('button', { name: t('expense-form.save') }).click();
  await expect(toast(page, t('expense-form.created'))).toBeVisible();
  await expect(visible(page.getByText('Albergo'))).toBeVisible();

  // Segmento Saldi: Archimede deve metà
  await visible(page.locator('ion-segment-button[value="balances"]')).click();
  await expect(
    visible(page.locator('ion-item').filter({ hasText: t('balances.owes-you', { name: 'Archimede' }) })),
  ).toContainText('€25.00');
});
