import { expect, test } from '@playwright/test';
import { t } from './support/i18n';
import { visible } from './support/ionic';
import { USERS } from './support/session';

test.describe('login (solo email)', () => {
  test('un utente esistente entra e arriva su Activity', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: t('login.email-label') }).fill(USERS.minni);
    await page.getByRole('button', { name: t('login.submit') }).click();

    await expect(page).toHaveURL(/\/tabs\/activity$/);
    // Minni non partecipa a nessuna spesa: stato vuoto.
    await expect(visible(page.getByText(t('activity.empty-title')))).toBeVisible();
  });

  test('un\'email sconosciuta resta sul login con un errore', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: t('login.email-label') }).fill('nessuno@disney.test');
    await page.getByRole('button', { name: t('login.submit') }).click();

    await expect(page.getByText(t('login.user-not-found'))).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('un deep link senza sessione torna alla pagina chiesta dopo il login', async ({ page }) => {
    await page.goto('/tabs/balances');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftabs%2Fbalances/);

    await page.getByRole('textbox', { name: t('login.email-label') }).fill(USERS.minni);
    await page.getByRole('button', { name: t('login.submit') }).click();

    await expect(page).toHaveURL(/\/tabs\/balances$/);
  });
});
