import { expect, test } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { topModal, visible } from './support/ionic';
import { apiLogin, createExpense, createGroup, createInvite, loginAs, USERS, type Session } from './support/session';

// Cancellazione dell'account (2026-11-08): la riga User resta svuotata, le spese
// condivise restano per i saldi degli altri, il resto sparisce.

function auth(session: Session) {
  return { headers: { Authorization: `Bearer ${session.accessToken}` } };
}

interface ApiExpense {
  publicId: string;
  description: string;
  category: unknown;
  paidBy: { publicId: string; nickName: string };
  expenseContributions: { user: { publicId: string; nickName: string } }[];
}

test('via API: cosa sparisce, cosa resta e cosa non si puo\' piu\' fare', async ({ request }) => {
  const leaver = await apiLogin(request, USERS.anacleto);
  const survivor = await apiLogin(request, USERS.basettoni);

  const solo = await createExpense(request, leaver, { amount: 12, description: 'Solo mia' });
  const category = await (
    await request.post(`${API_URL}/category`, { ...auth(leaver), data: { name: 'Segreta' } })
  ).json();
  const shared = await createExpense(request, leaver, {
    amount: 30,
    description: 'Cena condivisa',
    participantPublicIds: [survivor.user.publicId],
    categoryPublicId: category.publicId,
  });
  const settlement = await request.post(`${API_URL}/settlement`, {
    ...auth(leaver),
    data: { fromPublicId: survivor.user.publicId, toPublicId: leaver.user.publicId, amount: 5, note: 'Nota privata' },
  });
  expect(settlement.ok()).toBeTruthy();
  const group = await createGroup(request, leaver, 'Viaggio', [survivor]);
  await createInvite(request, leaver, group.publicId);
  const lonely = await createGroup(request, leaver, 'Solitario');
  await request.post(`${API_URL}/user/blocks`, { ...auth(survivor), data: { publicId: leaver.user.publicId } });

  const deleted = await request.delete(`${API_URL}/user/me`, auth(leaver));
  expect(deleted.status()).toBe(204);

  // La sessione e' morta.
  expect((await request.get(`${API_URL}/expense`, auth(leaver))).status()).toBe(401);

  // Le spese solo sue e i gruppi rimasti vuoti non esistono piu'.
  expect((await request.get(`${API_URL}/expense/${solo.publicId}`, auth(survivor))).status()).toBe(404);
  expect((await request.get(`${API_URL}/group/${lonely.publicId}`, auth(survivor))).status()).toBe(404);

  // Quella condivisa resta, senza il suo nome ne' la sua categoria.
  const expenses = (await (await request.get(`${API_URL}/expense`, auth(survivor))).json()) as ApiExpense[];
  const dinner = expenses.find((e) => e.publicId === shared.publicId) as ApiExpense;
  expect(dinner.description).toBe('Cena condivisa');
  expect(dinner.category).toBeNull();
  expect(dinner.paidBy.nickName).toMatch(/^~deleted~/);
  expect(dinner.paidBy.publicId).not.toBe(leaver.user.publicId);
  expect(JSON.stringify(dinner)).not.toContain(leaver.user.nickName);
  const ghost = dinner.paidBy;

  // Rimborso senza la sua nota; dal gruppo e' uscito e il suo link e' revocato.
  const settlements = (await (await request.get(`${API_URL}/settlement`, auth(survivor))).json()) as { note: string | null }[];
  expect(settlements.map((s) => s.note)).toEqual([null]);
  const viaggio = await (await request.get(`${API_URL}/group/${group.publicId}`, auth(survivor))).json();
  expect(viaggio.members.map((m: { publicId: string }) => m.publicId)).toEqual([survivor.user.publicId]);
  const invite = await (await request.get(`${API_URL}/group/${group.publicId}/invite`, auth(survivor))).json();
  expect(invite.invite).toBeNull();

  // Non lo trova piu' nessuno, nemmeno col nuovo nickname, e non entra in altre spese.
  for (const q of [leaver.user.nickName, leaver.user.email, ghost.nickName]) {
    const search = await request.get(`${API_URL}/user`, { ...auth(survivor), params: { q } });
    expect(await search.json()).toEqual([]);
  }
  const contacts = (await (await request.get(`${API_URL}/user/contacts`, auth(survivor))).json()) as { publicId: string }[];
  expect(contacts.map((c) => c.publicId)).not.toContain(ghost.publicId);
  const added = await request.post(`${API_URL}/expense`, {
    ...auth(survivor),
    data: { amount: 10, participantPublicIds: [ghost.publicId] },
  });
  expect(added.status()).toBe(400);

  // Chi resta puo' ancora modificare la spesa e azzerare il saldo.
  const edited = await request.patch(`${API_URL}/expense/${shared.publicId}`, {
    ...auth(survivor),
    data: { description: 'Cena corretta' },
  });
  expect(edited.ok()).toBeTruthy();
  const repaid = await request.post(`${API_URL}/settlement`, {
    ...auth(survivor),
    data: { fromPublicId: survivor.user.publicId, toPublicId: ghost.publicId, amount: 10 },
  });
  expect(repaid.ok()).toBeTruthy();

  // L'email e' di nuovo libera: un nuovo login e' un account nuovo, vuoto.
  const again = await apiLogin(request, USERS.anacleto);
  expect(again.user.publicId).not.toBe(leaver.user.publicId);
  const fresh = await (await request.get(`${API_URL}/expense`, auth(again))).json();
  expect(fresh).toEqual([]);
});

test('dal Profilo: la schermata avvisa dei saldi, Annulla non fa niente, poi si esce', async ({ page }) => {
  const survivor = await apiLogin(page.request, USERS.basettoni);
  const leaver = await loginAs(page, USERS.manetta);
  await createExpense(page.request, survivor, {
    amount: 40,
    description: 'Pranzo',
    participantPublicIds: [leaver.user.publicId],
  });

  await page.goto('/profile');
  const row = visible(page.getByRole('button', { name: t('profile.delete.title') }));
  await row.click();
  let modal = topModal(page);
  await expect(modal.getByText(t('profile.delete.balances-title'))).toBeVisible();
  await expect(modal.getByText(t('profile.delete.balances-owe', { amount: '€20.00' }))).toBeVisible();

  await modal.getByRole('button', { name: t('profile.cancel') }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(modal).toBeHidden();
  const stillThere = await page.request.get(`${API_URL}/expense`, auth(leaver));
  expect(stillThere.ok()).toBeTruthy();

  await row.click();
  modal = topModal(page);
  const confirm = modal.getByRole('button', { name: t('profile.delete.confirm') });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => window.localStorage.getItem('split_auth'))).toBeNull();
  expect((await page.request.get(`${API_URL}/expense`, auth(leaver))).status()).toBe(401);
});

test('chi resta vede "Utente eliminato" nei saldi', async ({ page }) => {
  await loginAs(page, USERS.basettoni);
  await page.goto('/tabs/balances');
  await expect(
    visible(page.getByText(t('balances.owes-you', { name: t('common.deleted-user') }))).first(),
  ).toBeVisible();
});
