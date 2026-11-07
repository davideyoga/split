import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL } from './support/env';
import { t } from './support/i18n';
import { toast, visible } from './support/ionic';
import { clearMail, readOtp } from './support/outbox';
import { apiLogin, createGroup, createInvite, joinGroup, USERS, type Session } from './support/session';

// Link d'invito ai gruppi (2026-11-07, doc/InvitiGruppo.md): nei gruppi si
// entra solo cosi'.

function auth(session?: Session) {
  return session ? { headers: { Authorization: `Bearer ${session.accessToken}` } } : {};
}

async function preview(request: APIRequestContext, token: string, session?: Session) {
  return request.post(`${API_URL}/invite/preview`, { ...auth(session), data: { token } });
}

test('link d\'invito via API: chi lo crea, anteprima, ingresso, revoca', async ({ request }) => {
  const ezechiele = await apiLogin(request, USERS.ezechiele);
  const trudy = await apiLogin(request, USERS.trudy);
  const gambadilegno = await apiLogin(request, USERS.gambadilegno);

  // Il gruppo nasce col solo creatore, anche se un client vecchio manda dei membri.
  const created = await request.post(`${API_URL}/group`, {
    ...auth(ezechiele),
    data: { name: 'Bosco', memberPublicIds: [trudy.user.publicId] },
  });
  expect(created.ok()).toBeTruthy();
  const group = (await created.json()) as { publicId: string; members: unknown[] };
  expect(group.members).toHaveLength(1);
  // L'aggiunta di membri dalla ricerca non c'e' piu'.
  const addMembers = await request.post(`${API_URL}/group/${group.publicId}/members`, {
    ...auth(ezechiele),
    data: { memberPublicIds: [trudy.user.publicId] },
  });
  expect(addMembers.status()).toBe(404);

  // Solo un membro crea il link, e solo con le scadenze previste.
  const byOutsider = await request.post(`${API_URL}/group/${group.publicId}/invite`, {
    ...auth(gambadilegno),
    data: { expiresInDays: 7 },
  });
  expect(byOutsider.status()).toBe(403);
  const badExpiry = await request.post(`${API_URL}/group/${group.publicId}/invite`, {
    ...auth(ezechiele),
    data: { expiresInDays: 3 },
  });
  expect(badExpiry.status()).toBe(400);

  const token = await createInvite(request, ezechiele, group.publicId);
  const active = await request.get(`${API_URL}/group/${group.publicId}/invite`, auth(ezechiele));
  const { invite } = (await active.json()) as { invite: { expiresAt: string } | null };
  const days = (new Date(invite?.expiresAt ?? 0).getTime() - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(6.9);
  expect(days).toBeLessThanOrEqual(7);

  // Anteprima pubblica: niente nomi dei membri ne' publicId del gruppo.
  const anonymous = await preview(request, token);
  expect(anonymous.ok()).toBeTruthy();
  const body = await anonymous.json();
  expect(body).toMatchObject({
    groupName: 'Bosco',
    invitedBy: 'Ezechiele',
    memberCount: 1,
    alreadyMember: false,
    groupPublicId: null,
  });
  expect(Object.keys(body).sort()).toEqual(
    ['alreadyMember', 'expiresAt', 'groupName', 'groupPublicId', 'invitedBy', 'memberCount'],
  );
  // A chi e' gia' membro dice il gruppo.
  expect(await (await preview(request, token, ezechiele)).json()).toMatchObject({
    alreadyMember: true,
    groupPublicId: group.publicId,
  });

  // Ingresso idempotente; poi Trudy vede il gruppo.
  const join = async (session: Session, value: string) =>
    request.post(`${API_URL}/invite/join`, { ...auth(session), data: { token: value } });
  expect(await (await join(trudy, token)).json()).toEqual({ groupPublicId: group.publicId, joined: true });
  expect(await (await join(trudy, token)).json()).toEqual({ groupPublicId: group.publicId, joined: false });
  const asTrudy = await request.get(`${API_URL}/group/${group.publicId}`, auth(trudy));
  expect(asTrudy.ok()).toBeTruthy();
  expect(((await asTrudy.json()) as { members: unknown[] }).members).toHaveLength(2);
  // Senza sessione non si entra.
  expect((await request.post(`${API_URL}/invite/join`, { data: { token } })).status()).toBe(401);

  // Un link nuovo revoca il precedente.
  const second = await createInvite(request, trudy, group.publicId, 1);
  const revoked = await preview(request, token);
  expect(revoked.status()).toBe(410);
  expect((await revoked.json()).code).toBe('INVITE_REVOKED');
  const lateJoin = await join(gambadilegno, token);
  expect(lateJoin.status()).toBe(410);

  // Revoca esplicita: anche il secondo smette di funzionare; chi e' dentro resta.
  const revoke = await request.delete(`${API_URL}/group/${group.publicId}/invite`, auth(ezechiele));
  expect(revoke.status()).toBe(204);
  expect((await (await preview(request, second)).json()).code).toBe('INVITE_REVOKED');
  const none = await request.get(`${API_URL}/group/${group.publicId}/invite`, auth(ezechiele));
  expect(await none.json()).toEqual({ invite: null });
  expect((await request.get(`${API_URL}/group/${group.publicId}`, auth(trudy))).ok()).toBeTruthy();

  // Token malformato: 400; ben formato ma sconosciuto: 404.
  expect((await preview(request, 'corto')).status()).toBe(400);
  const unknown = await preview(request, 'x'.repeat(43));
  expect(unknown.status()).toBe(404);
  expect((await unknown.json()).code).toBe('INVITE_NOT_FOUND');
});

/** Login dalla pagina di login, come farebbe una persona. */
async function loginFromUi(page: Page, email: string) {
  clearMail(email);
  await page.getByRole('textbox', { name: t('login.email-label') }).fill(email);
  await page.getByRole('button', { name: t('login.send-code') }).click();
  await page.getByRole('textbox', { name: t('login.code-label') }).fill(await readOtp(email));
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
}

test('dal link al gruppo: login, ritorno su /join, Unisciti', async ({ page }) => {
  const ezechiele = await apiLogin(page.request, USERS.ezechiele);
  const group = await createGroup(page.request, ezechiele, 'Stagno');
  const token = await createInvite(page.request, ezechiele, group.publicId);

  // Senza sessione: anteprima, e il token sparisce dalla barra degli indirizzi.
  await page.goto(`/join#${token}`);
  await expect(page.getByText(t('join.invited-by', { name: 'Ezechiele' }))).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stagno' })).toBeVisible();
  await expect(page).toHaveURL(/\/join$/);

  // Login e ritorno su /join: il token e' passato da sessionStorage, non dall'URL.
  await page.getByRole('button', { name: t('join.login') }).click();
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fjoin$/);
  await loginFromUi(page, USERS.gongolo);
  await expect(page).toHaveURL(/\/join$/);

  await page.getByRole('button', { name: t('join.join') }).click();
  await expect(toast(page, t('join.joined', { group: 'Stagno' }))).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/tabs/groups/${group.publicId}$`));
  await expect(visible(page.locator('ion-title').filter({ hasText: 'Stagno' }))).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('split.inviteToken'))).toBeNull();

  // Riaprendo il link: gia' membro, si apre il gruppo.
  await page.goto(`/join#${token}`);
  await expect(page.getByText(t('join.already-member'))).toBeVisible();
  await page.getByRole('button', { name: t('join.open-group') }).click();
  await expect(page).toHaveURL(new RegExp(`/tabs/groups/${group.publicId}$`));

  // Il creatore lo sa dalle notifiche.
  const notifications = await page.request.get(`${API_URL}/notification`, auth(ezechiele));
  const [latest] = (await notifications.json()) as { type: string; actor: { nickName: string } }[];
  expect(latest).toMatchObject({ type: 'GROUP_JOINED', actor: { nickName: 'Gongolo' } });
});

test('un link revocato dice di chiederne uno nuovo', async ({ page }) => {
  const ezechiele = await apiLogin(page.request, USERS.ezechiele);
  const group = await createGroup(page.request, ezechiele, 'Tana');
  const token = await createInvite(page.request, ezechiele, group.publicId);
  await joinGroup(page.request, await apiLogin(page.request, USERS.trudy), token);
  await page.request.delete(`${API_URL}/group/${group.publicId}/invite`, auth(ezechiele));

  await page.goto(`/join#${token}`);
  await expect(page.getByText(t('join.error-revoked'))).toBeVisible();
  await expect(page.getByRole('button', { name: t('join.join') })).toHaveCount(0);
});

test('chi non ha un account entra dal link: registrazione, nome, gruppo', async ({ page }) => {
  const ezechiele = await apiLogin(page.request, USERS.ezechiele);
  const group = await createGroup(page.request, ezechiele, 'Radura');
  const token = await createInvite(page.request, ezechiele, group.publicId);

  await page.goto(`/join#${token}`);
  await page.getByRole('button', { name: t('join.login') }).click();
  await loginFromUi(page, 'nuova.amica@disney.test');

  // Account appena creato: prima il nome, poi di nuovo il link.
  await expect(page).toHaveURL(/\/welcome\?returnUrl=%2Fjoin$/);
  await page.getByRole('textbox', { name: t('profile.nickname') }).fill('Nuova.Amica');
  await page.getByRole('button', { name: t('welcome.continue') }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole('heading', { name: 'Radura' })).toBeVisible();

  await page.getByRole('button', { name: t('join.join') }).click();
  await expect(page).toHaveURL(new RegExp(`/tabs/groups/${group.publicId}$`));
  const members = await page.request.get(`${API_URL}/group/${group.publicId}`, auth(ezechiele));
  expect(((await members.json()) as { members: { nickName: string }[] }).members.map((m) => m.nickName)).toEqual(
    expect.arrayContaining(['Ezechiele', 'Nuova.Amica']),
  );
});
