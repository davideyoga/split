import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { visible } from './support/ionic';
import { clearMail, hasMail, readOtp } from './support/outbox';
import { loginAs, USERS } from './support/session';

/** Primo passaggio del login: email -> "Invia codice". */
async function requestCode(page: Page, email: string) {
  clearMail(email);
  await page.getByRole('textbox', { name: t('login.email-label') }).fill(email);
  await page.getByRole('button', { name: t('login.send-code') }).click();
  await expect(page.getByRole('textbox', { name: t('login.code-label') })).toBeVisible();
}

async function enterCode(page: Page, otp: string) {
  await page.getByRole('textbox', { name: t('login.code-label') }).fill(otp);
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
}

test.describe('login con codice via email', () => {
  test('un utente esistente riceve il codice ed entra su Activity', async ({ page }) => {
    await page.goto('/login');
    await requestCode(page, USERS.minni);

    // Un codice sbagliato non fa entrare, quello giusto si'.
    await enterCode(page, '000000');
    await expect(page.getByText(t('login.invalid-code'))).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await enterCode(page, await readOtp(USERS.minni));
    await expect(page).toHaveURL(/\/tabs\/activity$/);
    // Minni non partecipa a nessuna spesa: stato vuoto.
    await expect(visible(page.getByText(t('activity.empty-title')))).toBeVisible();
  });

  test('un\'email sconosciuta non riceve nulla e nessun codice la fa entrare', async ({ page }) => {
    const unknown = 'nessuno@disney.test';
    await page.goto('/login');
    // Stessa schermata di un utente esistente: non si scopre chi e' registrato.
    await requestCode(page, unknown);
    expect(hasMail(unknown)).toBe(false);

    await enterCode(page, '123456');
    await expect(page.getByText(t('login.invalid-code'))).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('un deep link senza sessione torna alla pagina chiesta dopo il login', async ({ page }) => {
    await page.goto('/tabs/balances');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftabs%2Fbalances/);

    await requestCode(page, USERS.minni);
    await enterCode(page, await readOtp(USERS.minni));

    await expect(page).toHaveURL(/\/tabs\/balances$/);
  });

  test('il logout dal Profilo chiude la sessione anche sul server', async ({ page }) => {
    const session = await loginAs(page, USERS.minni);
    await page.goto('/tabs/profile');
    await visible(page.getByText(t('profile.logout'))).click();
    await page.locator('ion-alert').getByRole('button', { name: t('profile.logout') }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Il token di prima non vale piu'.
    await expect
      .poll(async () => {
        const response = await page.request.get(`${API_URL}/expense`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        return response.status();
      })
      .toBe(401);
  });
});
