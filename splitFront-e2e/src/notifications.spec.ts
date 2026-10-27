import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { visible } from './support/ionic';
import { apiLogin, createExpense, createGroup, loginAs, makeFriends, USERS, type Session } from './support/session';

interface ApiNotification {
  publicId: string;
  type: string;
  read: boolean;
  actor: Record<string, unknown> | null;
  expense: { publicId: string; description: string } | null;
  params: Record<string, unknown> | null;
}

function auth(session: Session) {
  return { headers: { Authorization: `Bearer ${session.accessToken}` } };
}

// Notifiche gia' presenti prima dei controlli (quelle lasciate da makeFriends):
// i controlli guardano solo quelle nuove.
const baseline = new Set<string>();

async function notifications(request: APIRequestContext, session: Session): Promise<ApiNotification[]> {
  const response = await request.get(`${API_URL}/notification`, auth(session));
  expect(response.ok(), `notifiche di ${session.user.nickName}`).toBeTruthy();
  return ((await response.json()) as ApiNotification[]).filter((n) => !baseline.has(n.publicId));
}

// Mette da parte le notifiche attuali e le segna come lette: il numero riparte da zero.
async function forgetExisting(request: APIRequestContext, session: Session) {
  const existing = await notifications(request, session);
  existing.forEach((n) => baseline.add(n.publicId));
  const read = await request.post(`${API_URL}/notification/read`, {
    ...auth(session),
    data: { publicIds: existing.map((n) => n.publicId) },
  });
  expect(read.ok()).toBeTruthy();
}

async function types(request: APIRequestContext, session: Session): Promise<string[]> {
  return (await notifications(request, session)).map((n) => n.type);
}

async function unreadCount(request: APIRequestContext, session: Session): Promise<number> {
  const response = await request.get(`${API_URL}/notification/unread-count`, auth(session));
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { count: number }).count;
}

async function patchExpense(
  request: APIRequestContext,
  session: Session,
  publicId: string,
  data: Record<string, unknown>,
) {
  const response = await request.patch(`${API_URL}/expense/${publicId}`, { ...auth(session), data });
  expect(response.ok(), `modifica ${JSON.stringify(data)}`).toBeTruthy();
}

// Notifiche (2026-10-25): chi fa l'azione non ne riceve; le riceve chi ne e'
// toccato, e non vede mai dati di una spesa che non puo' piu' aprire.
test('notifiche via API: chi le riceve e cosa resta', async ({ request }) => {
  const rockerduck = await apiLogin(request, USERS.rockerduck);
  const brigitta = await apiLogin(request, USERS.brigitta);
  const withBrigitta = { participantPublicIds: [brigitta.user.publicId] };
  // Amici, cosi' le spese contano subito per entrambi (le richieste hanno la
  // loro spec, friends.spec.ts).
  await makeFriends(request, rockerduck, brigitta);
  await forgetExisting(request, rockerduck);
  await forgetExisting(request, brigitta);

  // Spesa nuova: solo l'altra persona, con l'attore ridotto a publicId e nickname.
  const pizza = await createExpense(request, rockerduck, { amount: 30, description: 'Pizza', ...withBrigitta });
  expect(await types(request, rockerduck)).toEqual([]);
  const [added] = await notifications(request, brigitta);
  expect(added).toMatchObject({
    type: 'EXPENSE_ADDED',
    read: false,
    actor: { nickName: 'Rockerduck' },
    expense: { publicId: pizza.publicId, description: 'Pizza' },
  });
  expect(Object.keys(added.actor ?? {}).sort()).toEqual(['nickName', 'publicId']);

  // Le notifiche di un altro non si segnano come lette (la richiesta riesce,
  // ma non tocca niente); un id che non e' un uuid e' un 400.
  const asRockerduck = await request.post(`${API_URL}/notification/read`, {
    ...auth(rockerduck),
    data: { publicIds: [added.publicId] },
  });
  expect(asRockerduck.ok()).toBeTruthy();
  expect(await unreadCount(request, brigitta)).toBe(1);
  const invalid = await request.post(`${API_URL}/notification/read`, {
    ...auth(brigitta),
    data: { publicIds: ['non-un-id'] },
  });
  expect(invalid.status()).toBe(400);

  // Una modifica che non cambia niente non notifica; l'importo si'.
  await patchExpense(request, rockerduck, pizza.publicId, { description: 'Pizza' });
  expect(await types(request, brigitta)).toEqual(['EXPENSE_ADDED']);
  await patchExpense(request, rockerduck, pizza.publicId, { amount: 40 });
  expect(await types(request, brigitta)).toEqual(['EXPENSE_UPDATED', 'EXPENSE_ADDED']);

  // Tolta dalla spesa: le notifiche su quella spesa spariscono, resta
  // l'istantanea.
  await patchExpense(request, rockerduck, pizza.publicId, { participantPublicIds: [] });
  const afterRemoval = await notifications(request, brigitta);
  expect(afterRemoval.map((n) => n.type)).toEqual(['EXPENSE_REMOVED']);
  expect(afterRemoval[0]).toMatchObject({
    expense: null,
    params: { description: 'Pizza', amount: '40', currency: 'EUR' },
  });

  // Spesa eliminata: la sua EXPENSE_ADDED se ne va col cascade, arriva
  // EXPENSE_DELETED con l'istantanea.
  const gelato = await createExpense(request, rockerduck, { amount: 10, description: 'Gelato', ...withBrigitta });
  expect(await types(request, brigitta)).toEqual(['EXPENSE_ADDED', 'EXPENSE_REMOVED']);
  const deleted = await request.delete(`${API_URL}/expense/${gelato.publicId}`, auth(rockerduck));
  expect(deleted.status()).toBe(204);
  const afterDelete = await notifications(request, brigitta);
  expect(afterDelete.map((n) => n.type)).toEqual(['EXPENSE_DELETED', 'EXPENSE_REMOVED']);
  expect(afterDelete[0].params).toMatchObject({ description: 'Gelato', amount: '10' });

  // Gruppo (una volta sola, anche se la si aggiunge di nuovo) e rimborso.
  const group = await createGroup(request, rockerduck, 'Deposito', [brigitta.user.publicId]);
  const again = await request.post(`${API_URL}/group/${group.publicId}/members`, {
    ...auth(rockerduck),
    data: { memberPublicIds: [brigitta.user.publicId] },
  });
  expect(again.ok()).toBeTruthy();
  const settlement = await request.post(`${API_URL}/settlement`, {
    ...auth(rockerduck),
    data: { fromPublicId: brigitta.user.publicId, toPublicId: rockerduck.user.publicId, amount: 5 },
  });
  expect(settlement.ok()).toBeTruthy();
  expect(await types(request, brigitta)).toEqual([
    'SETTLEMENT_ADDED',
    'GROUP_ADDED',
    'EXPENSE_DELETED',
    'EXPENSE_REMOVED',
  ]);
  expect(await types(request, rockerduck)).toEqual([]);
});

test('campanella: numero, lista tradotta, lette all\'apertura', async ({ page }) => {
  const brigitta = await loginAs(page, USERS.brigitta);
  const rockerduck = await apiLogin(page.request, USERS.rockerduck);
  await makeFriends(page.request, rockerduck, brigitta);
  const cinema = await createExpense(page.request, rockerduck, {
    amount: 12,
    description: 'Cinema',
    participantPublicIds: [brigitta.user.publicId],
  });
  const settlement = await page.request.post(`${API_URL}/settlement`, {
    ...auth(rockerduck),
    data: { fromPublicId: brigitta.user.publicId, toPublicId: rockerduck.user.publicId, amount: 7 },
  });
  expect(settlement.ok()).toBeTruthy();
  const count = await unreadCount(page.request, brigitta);
  expect(count).toBeGreaterThan(0);

  await page.goto('/tabs/activity');
  const bell = visible(page.getByRole('link', { name: t('notifications.bell-unread', { count }) }));
  await expect(bell).toBeVisible();
  await expect(visible(page.locator('app-notification-bell ion-badge'))).toHaveText(
    count > 9 ? '9+' : String(count),
  );

  // La lista: testo tradotto, la nuova evidenziata.
  await bell.click();
  await expect(page).toHaveURL(/\/notifications$/);
  const text = t('notifications.type.EXPENSE_ADDED', {
    actor: 'Rockerduck',
    description: 'Cinema',
    amount: '€12.00',
  });
  const row = visible(page.locator('ion-item').filter({ hasText: text }));
  await expect(row).toHaveClass(/unread/);
  // Il rimborso registrato dall'altra persona, visto da chi ha dato.
  await expect(
    visible(page.getByText(t('notifications.type.SETTLEMENT_ADDED_FROM_ME', { actor: 'Rockerduck', amount: '€7.00' }))),
  ).toBeVisible();

  // Aperta la lista, il numero si azzera.
  await visible(page.locator('ion-back-button')).click();
  await expect(page).toHaveURL(/\/tabs\/activity$/);
  await expect(visible(page.getByRole('link', { name: t('notifications.bell'), exact: true }))).toBeVisible();
  await expect(page.locator('app-notification-bell ion-badge')).toHaveCount(0);
  expect(await unreadCount(page.request, brigitta)).toBe(0);

  // Alla visita dopo non e' piu' evidenziata, e si apre sulla spesa.
  await visible(page.getByRole('link', { name: t('notifications.bell'), exact: true })).click();
  await expect(row).toBeVisible();
  await expect(row).not.toHaveClass(/unread/);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/tabs/activity/expense/${cinema.publicId}$`));
});
