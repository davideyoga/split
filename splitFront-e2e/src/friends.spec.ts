import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { toast, visible } from './support/ionic';
import { acceptGroup, apiLogin, createExpense, createGroup, loginAs, USERS, type Session } from './support/session';

interface Contribution {
  share: string;
  pending: boolean;
  invitedBy: { nickName: string } | null;
  user: { nickName: string };
}

interface GroupBody {
  publicId: string;
  members: { nickName: string }[];
  invited: { nickName: string }[];
}

function auth(session: Session) {
  return { headers: { Authorization: `Bearer ${session.accessToken}` } };
}

function api(request: APIRequestContext) {
  async function get<T>(session: Session, path: string): Promise<T> {
    const response = await request.get(`${API_URL}${path}`, auth(session));
    expect(response.ok(), `GET ${path} come ${session.user.nickName}`).toBeTruthy();
    return response.json();
  }
  function post(session: Session, path: string) {
    return request.post(`${API_URL}${path}`, { ...auth(session), data: {} });
  }
  async function contributionOf(session: Session, expensePublicId: string, nickName: string) {
    const expense = await get<{ expenseContributions: Contribution[] }>(session, `/expense/${expensePublicId}`);
    return expense.expenseContributions.find((c) => c.user.nickName === nickName);
  }
  async function friendsOf(session: Session): Promise<string[]> {
    return (await get<{ nickName: string }[]>(session, '/friend')).map((f) => f.nickName).sort();
  }
  return { get, post, contributionOf, friendsOf };
}

// Amici (2026-10-25): con chi non e' amico la spesa resta in attesa finche'
// non la accetta; rifiutarla passa la quota a chi l'ha aggiunto; accettare
// rende amici e conta tutte le spese in attesa della stessa persona; un
// gruppo si accetta a parte e rende amici di tutti i membri.
test('amici via API: spese in attesa, rifiuto, accettazione e inviti ai gruppi', async ({ request }) => {
  const { get, post, contributionOf, friendsOf } = api(request);
  const paperoga = await apiLogin(request, USERS.paperoga);
  const gedeone = await apiLogin(request, USERS.gedeone);
  const bassotto = await apiLogin(request, USERS.bassotto);
  const withGedeone = { participantPublicIds: [gedeone.user.publicId] };

  // Non amici: la quota di Gedeone resta in attesa, quella di Paperoga no.
  const caffe = await createExpense(request, paperoga, { amount: 30, description: 'Caffè', ...withGedeone });
  const cena = await createExpense(request, paperoga, { amount: 40, description: 'Cena', ...withGedeone });
  expect(await contributionOf(gedeone, caffe.publicId, 'Gedeone')).toMatchObject({
    pending: true,
    share: '15',
    invitedBy: { nickName: 'Paperoga' },
  });
  expect((await contributionOf(gedeone, caffe.publicId, 'Paperoga'))?.pending).toBe(false);

  // Finche' non risponde, Gedeone non la puo' modificare.
  const patch = await request.patch(`${API_URL}/expense/${caffe.publicId}`, {
    ...auth(gedeone),
    data: { description: 'Altro' },
  });
  expect(patch.status()).toBe(403);

  // La richiesta: una persona, con le sue due spese.
  type Requests = {
    people: { user: { nickName: string }; expenses: { description: string }[] }[];
    groups: { name: string; memberCount: number; invitedBy: { nickName: string } }[];
  };
  const requests = await get<Requests>(gedeone, '/friend/requests');
  expect(requests.people.map((p) => p.user.nickName)).toEqual(['Paperoga']);
  expect(requests.people[0].expenses.map((e) => e.description).sort()).toEqual(['Caffè', 'Cena']);

  // Rifiutato il Caffè: tutto a carico di Paperoga; la Cena resta in attesa.
  expect((await post(gedeone, `/expense/${caffe.publicId}/reject`)).status()).toBe(204);
  const afterReject = await get<{ expenseContributions: Contribution[] }>(paperoga, `/expense/${caffe.publicId}`);
  expect(afterReject.expenseContributions.map((c) => [c.user.nickName, c.share])).toEqual([['Paperoga', '30']]);
  expect((await get<Requests>(gedeone, '/friend/requests')).people[0].expenses.map((e) => e.description)).toEqual([
    'Cena',
  ]);
  expect((await post(gedeone, `/expense/${caffe.publicId}/reject`)).status()).toBe(403);

  // Nessuno si fa amico da solo: senza una richiesta in attesa, 404.
  expect((await post(bassotto, `/friend/${paperoga.user.publicId}/accept`)).status()).toBe(404);
  expect(await friendsOf(bassotto)).toEqual([]);

  // Accettando Paperoga: amici, e la Cena conta.
  expect((await post(gedeone, `/friend/${paperoga.user.publicId}/accept`)).status()).toBe(204);
  expect(await friendsOf(gedeone)).toEqual(['Paperoga']);
  expect(await friendsOf(paperoga)).toEqual(['Gedeone']);
  expect((await contributionOf(gedeone, cena.publicId, 'Gedeone'))?.pending).toBe(false);
  expect((await get<Requests>(gedeone, '/friend/requests')).people).toEqual([]);

  // Fra amici una spesa nuova conta subito.
  const gelato = await createExpense(request, paperoga, { amount: 10, description: 'Gelato', ...withGedeone });
  expect((await contributionOf(gedeone, gelato.publicId, 'Gedeone'))?.pending).toBe(false);

  // Paperoga ha saputo del rifiuto e dell'accettazione.
  const paperogaTypes = (await get<{ type: string }[]>(paperoga, '/notification')).map((n) => n.type);
  expect(paperogaTypes.slice(0, 2)).toEqual(['FRIEND_ACCEPTED', 'EXPENSE_REJECTED']);

  // Gruppo con chi non e' amico: invito; rifiutato, sparisce.
  const bocce = (await createGroup(request, paperoga, 'Bocce', [bassotto.user.publicId])) as GroupBody;
  expect(bocce.members.map((m) => m.nickName)).toEqual(['Paperoga']);
  expect(bocce.invited.map((m) => m.nickName)).toEqual(['Bassotto']);
  expect((await request.get(`${API_URL}/group/${bocce.publicId}`, auth(bassotto))).status()).toBe(403);
  expect((await post(bassotto, `/group/${bocce.publicId}/decline`)).status()).toBe(204);
  expect((await get<GroupBody>(paperoga, `/group/${bocce.publicId}`)).invited).toEqual([]);

  // L'amico (Gedeone) entra subito, Bassotto e' invitato e resta fuori dalle spese.
  const gita = (await createGroup(request, paperoga, 'Gita', [
    gedeone.user.publicId,
    bassotto.user.publicId,
  ])) as GroupBody;
  expect(gita.members.map((m) => m.nickName).sort()).toEqual(['Gedeone', 'Paperoga']);
  expect(gita.invited.map((m) => m.nickName)).toEqual(['Bassotto']);
  const benzina = await createExpense(request, paperoga, {
    amount: 30,
    description: 'Benzina',
    groupPublicId: gita.publicId,
  });
  const benzinaBody = await get<{ expenseContributions: Contribution[] }>(paperoga, `/expense/${benzina.publicId}`);
  expect(benzinaBody.expenseContributions.map((c) => c.user.nickName).sort()).toEqual(['Gedeone', 'Paperoga']);
  expect((await get<Requests>(bassotto, '/friend/requests')).groups).toMatchObject([
    { name: 'Gita', memberCount: 2, invitedBy: { nickName: 'Paperoga' } },
  ]);

  // Accettato il gruppo: membro, e amico di tutti i membri.
  await acceptGroup(request, bassotto, gita.publicId);
  expect(await friendsOf(bassotto)).toEqual(['Gedeone', 'Paperoga']);
  expect((await get<GroupBody>(bassotto, `/group/${gita.publicId}`)).members.map((m) => m.nickName).sort()).toEqual([
    'Bassotto',
    'Gedeone',
    'Paperoga',
  ]);
});

test('richieste dall\'app: spese da accettare in Attività, rifiuto e accettazione', async ({ page }) => {
  const nocciola = await loginAs(page, USERS.nocciola);
  const gongolo = await apiLogin(page.request, USERS.gongolo);
  const withNocciola = { participantPublicIds: [nocciola.user.publicId] };
  await createExpense(page.request, gongolo, { amount: 20, description: 'Pranzo', ...withNocciola });
  await createExpense(page.request, gongolo, { amount: 10, description: 'Taxi', ...withNocciola });

  // Attività: le due spese non sono in lista, c'e' il riquadro delle richieste.
  await page.goto('/tabs/activity');
  const pendingCard = visible(page.locator('ion-card.pending-card'));
  await expect(pendingCard).toContainText(t('activity.pending-many', { count: 2 }));
  await expect(visible(page.getByRole('heading', { name: 'Pranzo', exact: true }))).toHaveCount(0);

  // Notifiche: la richiesta di Gongolo con le sue due spese.
  await pendingCard.click();
  await expect(page).toHaveURL(/\/notifications$/);
  const request = visible(page.locator('ion-card.request')).filter({
    hasText: t('notifications.request-title', { name: 'Gongolo' }),
  });
  await expect(request).toContainText('Taxi');

  // Rifiuto del Taxi, con conferma: resta il Pranzo.
  await request.getByRole('button', { name: t('notifications.reject-expense', { description: 'Taxi' }) }).click();
  await page.locator('ion-alert').getByRole('button', { name: t('notifications.reject') }).click();
  await expect(toast(page, t('notifications.rejected'))).toBeVisible();
  await expect(request).not.toContainText('Taxi');
  await expect(request).toContainText('Pranzo');

  // Accettato Gongolo, la richiesta sparisce.
  await request.getByRole('button', { name: t('notifications.accept-person', { name: 'Gongolo' }) }).click();
  await expect(toast(page, t('notifications.accepted'))).toBeVisible();
  await expect(request).toHaveCount(0);

  // In Attività il Pranzo ora c'e', e non resta niente da accettare.
  await visible(page.locator('ion-back-button')).click();
  await expect(page).toHaveURL(/\/tabs\/activity$/);
  await expect(visible(page.getByRole('heading', { name: 'Pranzo', exact: true }))).toBeVisible();
  await expect(visible(page.locator('ion-card.pending-card'))).toHaveCount(0);
});
