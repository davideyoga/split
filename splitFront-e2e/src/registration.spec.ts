import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { visible } from './support/ionic';
import { clearMail, readOtp } from './support/outbox';
import { apiLogin } from './support/session';

// Registrazione aperta (AUTH_SIGN_UP=open nello stack e2e): il primo codice
// valido di un'email sconosciuta crea l'account, che passa da /welcome a
// scegliere il nickname. Email tutte nuove, diverse in ogni test: il DB e2e
// riparte da zero a ogni esecuzione. Google e Apple non sono provabili qui
// (servono token firmati da loro): il collegamento per email e' verificato
// contro Better Auth in doc/Auth.md, "Verifica".

async function signUp(page: Page, email: string) {
  clearMail(email);
  await page.getByRole('textbox', { name: t('login.email-label') }).fill(email);
  await page.getByRole('button', { name: t('login.send-code') }).click();
  await page.getByRole('textbox', { name: t('login.code-label') }).fill(await readOtp(email));
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
}

function nicknameInput(page: Page) {
  return page.getByRole('textbox', { name: t('profile.nickname') });
}

test.describe('registrazione', () => {
  test('un\'email nuova riceve il codice, sceglie il nickname ed entra', async ({ page }) => {
    await page.goto('/login');
    await signUp(page, 'nuovo.utente@disney.test');

    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByRole('heading', { name: t('welcome.heading') })).toBeVisible();
    // Il nickname provvisorio (user + 8 cifre) non si propone.
    await expect(nicknameInput(page)).toHaveValue('');

    // Stesse regole e stesso "gia' usato" del Profilo.
    await nicknameInput(page).fill('Minni');
    await page.getByRole('button', { name: t('welcome.continue') }).click();
    await expect(page.getByText(t('profile.nickname-error.NICKNAME_TAKEN'))).toBeVisible();

    await nicknameInput(page).fill('Nuovo.Utente');
    await page.getByRole('button', { name: t('welcome.continue') }).click();
    await expect(page).toHaveURL(/\/tabs\/activity$/);
    await expect(visible(page.getByText(t('activity.empty-title')))).toBeVisible();

    // Scelto una volta, resta scelto anche ricaricando.
    await page.goto('/profile');
    await expect(visible(page.getByText('Nuovo.Utente')).first()).toBeVisible();
  });

  test('il link aperto prima di avere l\'account si riprende dopo /welcome', async ({ page }) => {
    await page.goto('/tabs/balances');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftabs%2Fbalances/);
    await signUp(page, 'con.link@disney.test');

    await expect(page).toHaveURL(/\/welcome\?returnUrl=%2Ftabs%2Fbalances/);
    await nicknameInput(page).fill('Con.Link');
    await page.getByRole('button', { name: t('welcome.continue') }).click();
    await expect(page).toHaveURL(/\/tabs\/balances$/);
  });

  test('senza nickname scelto ogni pagina riporta a /welcome', async ({ page }) => {
    const email = 'senza.nome@disney.test';
    const session = await apiLogin(page.request, email);
    expect(session.user.nickName).toMatch(/^user\d{8}$/);
    await page.addInitScript((value) => {
      window.localStorage.setItem('split_auth', value);
    }, JSON.stringify({ ...session, user: { ...session.user, needsName: true } }));

    await page.goto('/tabs/groups');
    await expect(page).toHaveURL(/\/welcome\?returnUrl=%2Ftabs%2Fgroups/);

    // "Usa un altro account" esce davvero.
    await page.getByRole('button', { name: t('welcome.other-account') }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect
      .poll(async () => {
        const response = await page.request.get(`${API_URL}/expense`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        return response.status();
      })
      .toBe(401);
  });

  test('la ricerca utenti ha un limite orario per utente', async ({ request }) => {
    const { accessToken } = await apiLogin(request, 'cerca.molto@disney.test');
    const search = (q: string) =>
      request.get(`${API_URL}/user`, { params: { q }, headers: { Authorization: `Bearer ${accessToken}` } });

    for (let i = 0; i < 30; i++) {
      expect((await search(`nessuno${i}@disney.test`)).status()).toBe(200);
    }
    const blocked = await search('minni@disney.test');
    expect(blocked.status()).toBe(429);
    expect((await blocked.json()).code).toBe('SEARCH_RATE_LIMITED');
  });
});
