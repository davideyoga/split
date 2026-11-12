import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import {
  fakeSubscription,
  readPushes,
  subscribePush,
  unsubscribePush,
  waitForPushes,
  type FakeSubscription,
} from './support/push';
import { apiLogin, createExpense, loginAs, USERS, type Session } from './support/session';

// Push (doc/NotifichePush.md): l'API dei test le scrive in un outbox invece di
// mandarle, e qui al posto del browser ci sono iscrizioni finte. Il browser
// vero (service worker, permesso, tocco sulla notifica) non e' coperto: in e2e
// il service worker non c'e'.

function money(amount: number, locale: 'it' | 'en'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
}

function auth(session: Session) {
  return { headers: { Authorization: `Bearer ${session.accessToken}` } };
}

async function subscribe(request: APIRequestContext, session: Session, locale: 'it' | 'en'): Promise<FakeSubscription> {
  const subscription = fakeSubscription();
  const response = await subscribePush(request, session, subscription, locale);
  expect(response.status(), `iscrizione push di ${session.user.nickName}`).toBe(204);
  return subscription;
}

test('senza chiavi VAPID il server le dichiara spente e il Profilo non le mostra', async ({ page }) => {
  const etaBeta = await loginAs(page, USERS.etabeta);
  const config = await page.request.get(`${API_URL}/notification/push/config`, auth(etaBeta));
  expect(await config.json()).toEqual({ vapidPublicKey: null });

  await page.goto('/profile');
  await expect(page.getByText(t('profile.blocked'))).toBeVisible();
  await expect(page.getByText(t('push.toggle'))).toHaveCount(0);
});

test('arrivano solo i tipi scelti, a chi e\' dentro e nella lingua del suo dispositivo', async ({ request }) => {
  const etaBeta = await apiLogin(request, USERS.etabeta);
  const topesio = await apiLogin(request, USERS.topesio);
  const etaBetaBefore = readPushes(etaBeta).length;
  const before = readPushes(topesio).length;
  await subscribe(request, etaBeta, 'en');
  const phone = await subscribe(request, topesio, 'it');

  // Una spesa nuova: a Topesio si', a chi l'ha creata no.
  const pizza = await createExpense(request, etaBeta, {
    amount: 30,
    description: 'Pizza',
    participantPublicIds: [topesio.user.publicId],
  });
  let pushes = await waitForPushes(topesio, before + 1);
  const expenseUrl = `/tabs/activity/expense/${pizza.publicId}`;
  expect(pushes[before].endpoint).toBe(phone.endpoint);
  expect(pushes[before].payload.notification).toEqual({
    title: 'Split',
    body: `EtaBeta ti ha aggiunto a “Pizza” (${money(30, 'it')})`,
    icon: '/icons/icon-192.png',
    lang: 'it',
    data: {
      url: expenseUrl,
      onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: expenseUrl } },
    },
  });
  expect(readPushes(etaBeta)).toHaveLength(etaBetaBefore);

  // Una modifica (EXPENSE_UPDATED) resta nella campanella. Il rimborso dopo fa
  // da sentinella: se la modifica fosse una push, arriverebbe prima di lui.
  const patched = await request.patch(`${API_URL}/expense/${pizza.publicId}`, {
    ...auth(etaBeta),
    data: { description: 'Pizza e birra' },
  });
  expect(patched.ok()).toBeTruthy();
  const settled = await request.post(`${API_URL}/settlement`, {
    ...auth(etaBeta),
    data: { fromPublicId: topesio.user.publicId, toPublicId: etaBeta.user.publicId, amount: 12 },
  });
  expect(settled.ok()).toBeTruthy();
  pushes = await waitForPushes(topesio, before + 2);
  expect(pushes[before + 1].payload.notification.body).toBe(
    `EtaBeta ha registrato un tuo rimborso di ${money(12, 'it')}`,
  );
  expect(pushes[before + 1].payload.notification.data.url).toBe('/tabs/balances');

  // Cambio lingua nell'app: lo stesso browser si iscrive di nuovo, e le push
  // dopo arrivano in inglese, una sola volta.
  const again = await subscribePush(request, topesio, { ...phone, keys: fakeSubscription().keys }, 'en');
  expect(again.status()).toBe(204);
  await createExpense(request, etaBeta, {
    amount: 8.5,
    description: 'Gelato',
    participantPublicIds: [topesio.user.publicId],
  });
  pushes = await waitForPushes(topesio, before + 3);
  expect(pushes[before + 2].endpoint).toBe(phone.endpoint);
  expect(pushes[before + 2].payload.notification.body).toBe(
    `EtaBeta added you to “Gelato” (${money(8.5, 'en')})`,
  );
});

test('il browser passa a chi lo iscrive dopo; chi lo disiscrive non riceve piu\' niente', async ({ request }) => {
  // Pennino e Paperinik non hanno altri dispositivi: i conteggi sono esatti.
  const etaBeta = await apiLogin(request, USERS.etabeta);
  const pennino = await apiLogin(request, USERS.pennino);
  const paperinik = await apiLogin(request, USERS.paperinik);
  const penninoBefore = readPushes(pennino).length;
  const paperinikBefore = readPushes(paperinik).length;

  // Lo stesso telefono, iscritto prima da Pennino e poi da Paperinik (un
  // altro account sullo stesso browser): le push vanno a chi lo usa adesso.
  const phone = await subscribe(request, pennino, 'it');
  const taken = await subscribePush(request, paperinik, { ...phone, keys: fakeSubscription().keys }, 'it');
  expect(taken.status()).toBe(204);
  await createExpense(request, etaBeta, {
    amount: 20,
    description: 'Cinema',
    participantPublicIds: [pennino.user.publicId, paperinik.user.publicId],
  });
  const paperinikPushes = await waitForPushes(paperinik, paperinikBefore + 1);
  expect(paperinikPushes[paperinikBefore].endpoint).toBe(phone.endpoint);
  expect(readPushes(pennino)).toHaveLength(penninoBefore);

  // Paperinik spegne le push. La spesa dopo arriva a Pennino su un browser
  // nuovo, che fa da sentinella: le due notifiche nascono nella stessa
  // transazione e partono nello stesso giro.
  await unsubscribePush(request, paperinik, phone.endpoint);
  const laptop = await subscribe(request, pennino, 'en');
  await createExpense(request, etaBeta, {
    amount: 5,
    description: 'Caffe',
    participantPublicIds: [pennino.user.publicId, paperinik.user.publicId],
  });
  const penninoPushes = await waitForPushes(pennino, penninoBefore + 1);
  expect(penninoPushes[penninoBefore].endpoint).toBe(laptop.endpoint);
  expect(penninoPushes[penninoBefore].payload.notification.body).toBe(
    `EtaBeta added you to “Caffe” (${money(5, 'en')})`,
  );
  expect(readPushes(paperinik)).toHaveLength(paperinikBefore + 1);
});

test('si accettano solo i servizi di consegna dei browser e chiavi valide', async ({ request }) => {
  const etaBeta = await apiLogin(request, USERS.etabeta);

  const elsewhere = await subscribePush(
    request,
    etaBeta,
    { ...fakeSubscription(), endpoint: 'https://10.0.0.1/internal' },
    'it',
  );
  expect(elsewhere.status()).toBe(400);
  expect((await elsewhere.json()).code).toBe('PUSH_ENDPOINT_UNSUPPORTED');

  const badKeys = await subscribePush(
    request,
    etaBeta,
    { ...fakeSubscription(), keys: { p256dh: 'abc', auth: 'def' } },
    'it',
  );
  expect(badKeys.status()).toBe(400);
  expect((await badKeys.json()).code).toBe('PUSH_KEYS_INVALID');
});
