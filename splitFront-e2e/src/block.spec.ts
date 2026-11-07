import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { toast, topModal, visible } from './support/ionic';
import { apiLogin, createExpense, createGroup, loginAs, USERS, type Session } from './support/session';

// "Blocca" ed "Esci dal gruppo" (2026-11-07, doc/InvitiGruppo.md): senza amici
// ne' richieste, sono la difesa contro chi ti aggiunge a spese che non vuoi.

function auth(session: Session) {
  return { headers: { Authorization: `Bearer ${session.accessToken}` } };
}

async function notificationIds(request: APIRequestContext, session: Session): Promise<Set<string>> {
  const response = await request.get(`${API_URL}/notification`, auth(session));
  return new Set(((await response.json()) as { publicId: string }[]).map((n) => n.publicId));
}

async function newNotificationTypes(request: APIRequestContext, session: Session, before: Set<string>) {
  const response = await request.get(`${API_URL}/notification`, auth(session));
  return ((await response.json()) as { publicId: string; type: string }[])
    .filter((n) => !before.has(n.publicId))
    .map((n) => n.type);
}

test('blocco via API: ricerca, contatti, spese, rimborsi e notifiche', async ({ request }) => {
  const filo = await apiLogin(request, USERS.filo);
  const macchia = await apiLogin(request, USERS.macchianera);

  // Prima del blocco hanno gia' una spesa e un gruppo in comune.
  const dinner = await createExpense(request, macchia, {
    amount: 20,
    description: 'Cena',
    participantPublicIds: [filo.user.publicId],
  });
  const group = await createGroup(request, macchia, 'Covo', [filo]);

  // Filo blocca Macchia.Nera (due volte: non e' un errore).
  for (let i = 0; i < 2; i++) {
    const blocked = await request.post(`${API_URL}/user/blocks`, {
      ...auth(filo),
      data: { publicId: macchia.user.publicId },
    });
    expect(blocked.status()).toBe(204);
  }
  const list = await request.get(`${API_URL}/user/blocks`, auth(filo));
  expect(await list.json()).toEqual([{ publicId: macchia.user.publicId, nickName: 'Macchia.Nera' }]);
  const self = await request.post(`${API_URL}/user/blocks`, { ...auth(filo), data: { publicId: filo.user.publicId } });
  expect(self.status()).toBe(400);
  const unknown = await request.post(`${API_URL}/user/blocks`, {
    ...auth(filo),
    data: { publicId: '00000000-0000-4000-8000-000000000000' },
  });
  expect(unknown.status()).toBe(404);
  const before = await notificationIds(request, filo);

  // Macchia.Nera non trova piu' Filo, e nessuno dei due vede l'altro fra i contatti.
  for (const q of ['Filo.Sganga', 'filo@disney.test']) {
    const search = await request.get(`${API_URL}/user`, { ...auth(macchia), params: { q } });
    expect(await search.json()).toEqual([]);
  }
  const contacts = async (session: Session) =>
    ((await (await request.get(`${API_URL}/user/contacts`, auth(session))).json()) as { nickName: string }[]).map(
      (u) => u.nickName,
    );
  expect(await contacts(macchia)).not.toContain('Filo.Sganga');
  expect(await contacts(filo)).not.toContain('Macchia.Nera');

  // Non puo' metterlo in una spesa nuova ne' registrare un rimborso con lui:
  // stesso errore di un utente che non esiste.
  const newExpense = await request.post(`${API_URL}/expense`, {
    ...auth(macchia),
    data: { amount: 5, description: 'Caffe', participantPublicIds: [filo.user.publicId] },
  });
  expect(newExpense.status()).toBe(400);
  const settlement = await request.post(`${API_URL}/settlement`, {
    ...auth(macchia),
    data: { fromPublicId: macchia.user.publicId, toPublicId: filo.user.publicId, amount: 5 },
  });
  expect(settlement.status()).toBe(400);

  // Quello che c'era resta: la spesa in comune si modifica e il gruppo si usa,
  // ma a Filo non arriva niente.
  const edited = await request.patch(`${API_URL}/expense/${dinner.publicId}`, { ...auth(macchia), data: { amount: 30 } });
  expect(edited.ok()).toBeTruthy();
  await createExpense(request, macchia, { amount: 40, description: 'Refurtiva', groupPublicId: group.publicId });
  expect(await newNotificationTypes(request, filo, before)).toEqual([]);

  // Sbloccato, tutto torna come prima.
  const unblocked = await request.delete(`${API_URL}/user/blocks/${macchia.user.publicId}`, auth(filo));
  expect(unblocked.status()).toBe(204);
  await createExpense(request, macchia, {
    amount: 6,
    description: 'Caffe',
    participantPublicIds: [filo.user.publicId],
  });
  expect(await newNotificationTypes(request, filo, before)).toEqual(['EXPENSE_ADDED']);
});

test('blocco dal dettaglio della spesa, sblocco dal Profilo', async ({ page }) => {
  await loginAs(page, USERS.filo);
  await page.goto('/tabs/activity');

  await visible(page.locator('app-expense-list ion-item').filter({ hasText: 'Cena' })).click();
  await expect(page).toHaveURL(/\/tabs\/activity\/expense\/[0-9a-f-]{36}$/);
  // La riga del partecipante (con l'iniziale), non quella di chi ha pagato.
  await visible(
    page.locator('app-expense-detail ion-item').filter({ has: page.locator('.avatar.initial') }).filter({ hasText: 'Macchia.Nera' }),
  ).click();
  await page
    .locator('ion-action-sheet')
    .getByRole('button', { name: t('block.block-name', { name: 'Macchia.Nera' }) })
    .click();
  await expect(toast(page, t('block.blocked', { name: 'Macchia.Nera' }))).toBeVisible();

  await page.goto('/profile');
  await page.getByRole('button', { name: t('profile.blocked') }).click();
  await expect(topModal(page).getByText('Macchia.Nera')).toBeVisible();
  await topModal(page).getByRole('button', { name: t('block.unblock-name', { name: 'Macchia.Nera' }) }).click();
  await expect(toast(page, t('block.unblocked', { name: 'Macchia.Nera' }))).toBeVisible();
  await expect(topModal(page).getByText(t('block.empty'))).toBeVisible();
});

test('esci dal gruppo dalle impostazioni', async ({ page }) => {
  const paperetta = await apiLogin(page.request, USERS.paperetta);
  const filo = await loginAs(page, USERS.filo);
  const group = await createGroup(page.request, paperetta, 'Laboratorio', [filo]);

  await page.goto(`/tabs/groups/${group.publicId}/settings`);
  await visible(page.getByRole('button', { name: t('groups.leave') })).click();
  await page.locator('ion-alert').getByRole('button', { name: t('groups.leave') }).click();
  await expect(toast(page, t('groups.left'))).toBeVisible();
  await expect(page).toHaveURL(/\/tabs\/groups$/);
  await expect(visible(page.getByText('Laboratorio'))).toHaveCount(0);

  // Il gruppo resta a chi c'e' ancora.
  const remaining = await page.request.get(`${API_URL}/group/${group.publicId}`, auth(paperetta));
  expect(((await remaining.json()) as { members: { nickName: string }[] }).members.map((m) => m.nickName)).toEqual([
    'Paperetta',
  ]);
});
