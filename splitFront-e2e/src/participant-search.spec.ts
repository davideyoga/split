import { expect, test } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { topModal } from './support/ionic';
import { apiLogin, createExpense, createGroup, loginAs, USERS, type Session } from './support/session';

// Ricerca utenti esatta (2026-10-25): nickname senza maiuscole o email, mai
// per parte del nome, mai se stessi, e la risposta non contiene l'email.
test('ricerca utenti via API: solo nickname o email esatti', async ({ request }) => {
  const battista = await apiLogin(request, USERS.battista);
  const search = async (q: string) => {
    const response = await request.get(`${API_URL}/user`, {
      headers: { Authorization: `Bearer ${battista.accessToken}` },
      params: { q },
    });
    expect(response.ok(), `ricerca "${q}"`).toBeTruthy();
    return (await response.json()) as Record<string, unknown>[];
  };

  const byNickname = await search('pluto');
  expect(byNickname.map((u) => u['nickName'])).toEqual(['Pluto']);
  // Solo publicId e nickname, anche cercando per email.
  expect(Object.keys(byNickname[0]).sort()).toEqual(['nickName', 'publicId']);

  expect(await search('  PLUTO@disney.test ')).toEqual(byNickname);
  expect(await search('Plut')).toEqual([]);
  expect(await search('pluto@disney')).toEqual([]);
  expect(await search('nessuno@disney.test')).toEqual([]);
  expect(await search('')).toEqual([]);
  // Se stessi no: chi crea la spesa ne fa gia' parte.
  expect(await search('Battista')).toEqual([]);
  expect(await search('battista@disney.test')).toEqual([]);
});

test('scelta partecipante: si cerca col bottone, per email o nickname esatto', async ({ page }) => {
  await loginAs(page, USERS.battista);
  await page.goto('/tabs/activity');

  await page.getByRole('button', { name: t('expense-form.title-new') }).click();
  await topModal(page).getByRole('button', { name: t('expense-form.split-with') }).click();

  const query = topModal(page).getByPlaceholder(t('select-participant.search-placeholder'));
  const searchButton = topModal(page).getByRole('button', {
    name: t('select-participant.search'),
    exact: true,
  });
  await expect(topModal(page).getByText(t('select-participant.search-hint'))).toBeVisible();
  await expect(searchButton).toBeDisabled();

  // Mentre si scrive non parte nessuna ricerca; parte il nome non basta.
  await query.fill('Plut');
  await expect(topModal(page).getByText(t('select-participant.search-hint'))).toBeVisible();
  await searchButton.click();
  await expect(topModal(page).getByText(t('select-participant.no-results'))).toBeVisible();

  // Cambiato il testo, il "nessun utente" sparisce; Invio vale come Cerca.
  await query.fill('pluto@disney.test');
  await expect(topModal(page).getByText(t('select-participant.no-results'))).toBeHidden();
  await query.press('Enter');
  await topModal(page).getByRole('button', { name: 'Pluto', exact: true }).click();

  // Tornati alla form, Pluto e' fra i partecipanti.
  await expect(topModal(page).locator('ion-chip').filter({ hasText: 'Pluto' })).toBeVisible();
});

// Contatti (2026-11-07): chi condivide gia' una spesa o un gruppo. Nessuno
// deve accettare niente: chi viene aggiunto c'e' subito, come in Splitwise.
test('contatti via API: chi condivide una spesa o un gruppo', async ({ request }) => {
  const gedeone = await apiLogin(request, USERS.gedeone);
  const paperoga = await apiLogin(request, USERS.paperoga);
  const nocciola = await apiLogin(request, USERS.nocciola);
  const bassotto = await apiLogin(request, USERS.bassotto);
  const contacts = async (session: Session) => {
    const response = await request.get(`${API_URL}/user/contacts`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(response.ok(), `contatti di ${session.user.nickName}`).toBeTruthy();
    return ((await response.json()) as { nickName: string }[]).map((u) => u.nickName);
  };

  await createExpense(request, gedeone, {
    amount: 12,
    description: 'Benzina',
    participantPublicIds: [paperoga.user.publicId],
  });
  await createGroup(request, gedeone, 'Officina', [nocciola]);

  expect(await contacts(gedeone)).toEqual(['Nocciola', 'Paperoga']);
  expect(await contacts(paperoga)).toEqual(['Gedeone']);
  expect(await contacts(nocciola)).toEqual(['Gedeone']);
  expect(await contacts(bassotto)).toEqual([]);
});

test('scelta partecipante: i contatti sono in lista e si filtrano scrivendo', async ({ page }) => {
  await loginAs(page, USERS.gedeone);
  await page.goto('/tabs/activity');

  await page.getByRole('button', { name: t('expense-form.title-new') }).click();
  await topModal(page).getByRole('button', { name: t('expense-form.split-with') }).click();
  await expect(topModal(page).getByText(t('select-participant.contacts'))).toBeVisible();
  await expect(topModal(page).getByText(t('select-participant.search-hint-contacts'))).toBeVisible();
  await expect(topModal(page).getByRole('button', { name: 'Nocciola', exact: true })).toBeVisible();

  await topModal(page).getByPlaceholder(t('select-participant.search-placeholder')).fill('pap');
  await expect(topModal(page).getByRole('button', { name: 'Nocciola', exact: true })).toBeHidden();
  await topModal(page).getByRole('button', { name: 'Paperoga', exact: true }).click();

  await expect(topModal(page).locator('ion-chip').filter({ hasText: 'Paperoga' })).toBeVisible();
});
