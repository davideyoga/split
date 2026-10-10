import { expect, test } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { loginAs, USERS } from './support/session';

test('cambio nickname dal Profilo: regole, nickname già usato, salvataggio', async ({ page }) => {
  const session = await loginAs(page, USERS.nonnapapera);
  await page.goto('/tabs/profile');

  await visible(page.getByRole('button', { name: /NonnaPapera/ })).click();
  const modal = topModal(page);
  const input = modal.getByRole('textbox', { name: t('profile.nickname') });
  const save = modal.getByRole('button', { name: t('profile.save') });
  const rules = { min: 5, max: 20 };

  // Ogni regola ha il suo messaggio, e Salva resta disabilitato
  await input.fill('Nonna Papera');
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_INVALID_CHAR', { char: t('profile.nickname-space') }))).toBeVisible();
  await expect(save).toBeDisabled();

  await input.fill('Nonnà');
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_INVALID_CHAR', { char: 'à' }))).toBeVisible();

  // "Troppo corto" solo dopo aver lasciato il campo
  await input.fill('Nonn');
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_TOO_SHORT', { ...rules, count: 4 }))).toBeHidden();
  await input.blur();
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_TOO_SHORT', { ...rules, count: 4 }))).toBeVisible();

  await input.fill('NonnaPaperaDiPaperopoli');
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_TOO_LONG', { ...rules, count: 23 }))).toBeVisible();

  await input.fill('-Nonna');
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_EDGE'))).toBeVisible();

  await input.fill('Nonna..Papera');
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_DOUBLE_SEPARATOR'))).toBeVisible();
  await expect(save).toBeDisabled();

  // Già usato da Pippo, anche se scritto con altre maiuscole: lo sa solo il backend
  await input.fill('pIPPO');
  await save.click();
  await expect(modal.getByText(t('profile.nickname-error.NICKNAME_TAKEN'))).toBeVisible();

  await input.fill('Nonna.Papera');
  await save.click();
  await expect(toast(page, t('profile.nickname-updated'))).toBeVisible();
  await expect(visible(page.getByRole('heading', { name: 'Nonna.Papera' }))).toBeVisible();

  // La copia in localStorage è aggiornata, quindi resta anche al prossimo avvio.
  // (Non con page.reload(): l'init script di loginAs riscriverebbe la sessione vecchia.)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('split_auth') ?? 'null'));
  expect(stored?.user?.nickName).toBe('Nonna.Papera');

  // Il backend applica le stesse regole anche senza passare dall'app
  const invalid = await page.request.patch(`${API_URL}/user/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { nickName: 'N.P' },
  });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).code).toBe('NICKNAME_TOO_SHORT');
});
