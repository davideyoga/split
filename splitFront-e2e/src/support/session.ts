import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL } from './env';
import { clearMail, readOtp } from './outbox';

/**
 * Utenti creati da scripts/prepare-db.mts (elenco in scripts/users.e2e.json),
 * solo nel database e2e. Ogni file di test usa una coppia
 * di utenti tutta sua, così i file possono girare in parallelo senza che uno
 * veda (o sposti i saldi de) le spese create da un altro.
 */
export const USERS = {
  pippo: 'pippo@disney.test',
  pluto: 'pluto@disney.test',
  paperino: 'paperino@disney.test',
  topolino: 'topolino@disney.test',
  minni: 'minni@disney.test',
  paperone: 'paperone@disney.test',
  qui: 'qui@disney.test',
  quo: 'quo@disney.test',
  qua: 'qua@disney.test',
  gastone: 'gastone@disney.test',
  archimede: 'archimede@disney.test',
  nonnapapera: 'nonnapapera@disney.test',
  amelia: 'amelia@disney.test',
  ciccio: 'ciccio@disney.test',
  clarabella: 'clarabella@disney.test',
  orazio: 'orazio@disney.test',
  battista: 'battista@disney.test',
  rockerduck: 'rockerduck@disney.test',
  brigitta: 'brigitta@disney.test',
  paperoga: 'paperoga@disney.test',
  gedeone: 'gedeone@disney.test',
  bassotto: 'bassotto@disney.test',
  nocciola: 'nocciola@disney.test',
  gongolo: 'gongolo@disney.test',
  ezechiele: 'ezechiele@disney.test',
  trudy: 'trudy@disney.test',
  gambadilegno: 'gambadilegno@disney.test',
  filo: 'filo@disney.test',
  macchianera: 'macchianera@disney.test',
  paperetta: 'paperetta@disney.test',
} as const;

export interface Session {
  accessToken: string;
  user: { publicId: string; nickName: string; email: string };
}

/**
 * Login via API, con le stesse due chiamate dell'app: richiesta del codice,
 * lettura del codice dall'outbox, scambio del codice con una sessione.
 */
export async function apiLogin(request: APIRequestContext, email: string): Promise<Session> {
  clearMail(email);
  const sent = await request.post(`${API_URL}/auth/email-otp/send-verification-otp`, {
    data: { email, type: 'sign-in' },
  });
  expect(sent.ok(), `invio codice a ${email}: ${sent.status()} ${await sent.text()}`).toBeTruthy();
  const otp = await readOtp(email);

  const response = await request.post(`${API_URL}/auth/sign-in/email-otp`, { data: { email, otp } });
  expect(response.ok(), `login API di ${email}`).toBeTruthy();
  const body = (await response.json()) as { token: string; user: { publicId: string; name: string; email: string } };
  // Stessa forma che AuthService salva in localStorage.
  return {
    accessToken: body.token,
    user: { publicId: body.user.publicId, nickName: body.user.name, email: body.user.email },
  };
}

/**
 * Apre l'app già autenticata: scrive la sessione nella chiave di localStorage
 * letta da AuthService (`split_auth`) prima che l'app parta. Il login dalla UI
 * ha il suo test (login.spec.ts), gli altri test partono da qui.
 */
export async function loginAs(page: Page, email: string): Promise<Session> {
  const session = await apiLogin(page.request, email);
  await page.addInitScript((value) => {
    window.localStorage.setItem('split_auth', value);
  }, JSON.stringify(session));
  return session;
}

/** Crea una spesa via API, per i test che partono da dati già presenti. Ne restituisce il publicId. */
export async function createExpense(
  request: APIRequestContext,
  session: Session,
  body: {
    amount: number;
    description?: string;
    participantPublicIds?: string[];
    groupPublicId?: string;
    paidByPublicId?: string;
    shares?: { userPublicId: string; share: number }[];
    // 'YYYY-MM-DD'; senza, il server usa la sua data di oggi.
    date?: string;
    categoryPublicId?: string;
  },
): Promise<{ publicId: string }> {
  const response = await request.post(`${API_URL}/expense`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: body,
  });
  expect(response.ok(), `creazione spesa ${JSON.stringify(body)}`).toBeTruthy();
  return response.json();
}

/**
 * Crea un gruppo via API e ci fa entrare `members` come nell'app (2026-11-07):
 * un link d'invito del creatore, poi `join` di ognuno. Il gruppo nasce col
 * solo creatore; ai membri gia' dentro arriva GROUP_JOINED per ogni ingresso.
 */
export async function createGroup(
  request: APIRequestContext,
  session: Session,
  name: string,
  members: Session[] = [],
): Promise<{ publicId: string }> {
  const response = await request.post(`${API_URL}/group`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { name },
  });
  expect(response.ok(), `creazione gruppo ${name}`).toBeTruthy();
  const group = (await response.json()) as { publicId: string };
  if (members.length > 0) {
    const token = await createInvite(request, session, group.publicId);
    for (const member of members) {
      await joinGroup(request, member, token);
    }
  }
  return group;
}

/** Link d'invito di un gruppo (revoca il precedente): ne restituisce il token. */
export async function createInvite(
  request: APIRequestContext,
  session: Session,
  groupPublicId: string,
  expiresInDays: 1 | 7 | 30 = 7,
): Promise<string> {
  const response = await request.post(`${API_URL}/group/${groupPublicId}/invite`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { expiresInDays },
  });
  expect(response.ok(), 'creazione link d\'invito').toBeTruthy();
  return ((await response.json()) as { token: string }).token;
}

/** Entra in un gruppo con il token del link. */
export async function joinGroup(request: APIRequestContext, session: Session, token: string): Promise<void> {
  const response = await request.post(`${API_URL}/invite/join`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { token },
  });
  expect(response.ok(), `${session.user.nickName} entra nel gruppo`).toBeTruthy();
}

/** publicId di una categoria preconfigurata (per slug: 'food', 'transport', ...). */
export async function presetCategoryId(
  request: APIRequestContext,
  session: Session,
  slug: string,
): Promise<string> {
  const response = await request.get(`${API_URL}/category`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(response.ok(), 'elenco categorie').toBeTruthy();
  const categories = (await response.json()) as { publicId: string; slug: string | null }[];
  const category = categories.find((c) => c.slug === slug);
  expect(category, `categoria preconfigurata ${slug}`).toBeTruthy();
  return (category as { publicId: string }).publicId;
}
