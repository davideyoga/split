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

/** Crea un gruppo via API (il creatore ne fa sempre parte). */
export async function createGroup(
  request: APIRequestContext,
  session: Session,
  name: string,
  memberPublicIds: string[],
): Promise<{ publicId: string }> {
  const response = await request.post(`${API_URL}/group`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { name, memberPublicIds },
  });
  expect(response.ok(), `creazione gruppo ${name}`).toBeTruthy();
  return response.json();
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

/**
 * Rende amici `a` e `b` come farebbe l'app (2026-10-25): `a` mette `b` in una
 * spesa, `b` accetta `a`, la spesa si elimina. Se sono gia' amici non fa
 * niente. Lascia a `b` una notifica EXPENSE_DELETED e ad `a` una
 * FRIEND_ACCEPTED.
 */
export async function makeFriends(request: APIRequestContext, a: Session, b: Session): Promise<void> {
  const headers = (s: Session) => ({ Authorization: `Bearer ${s.accessToken}` });
  const friends = await request.get(`${API_URL}/friend`, { headers: headers(a) });
  expect(friends.ok(), 'elenco amici').toBeTruthy();
  if (((await friends.json()) as { publicId: string }[]).some((f) => f.publicId === b.user.publicId)) {
    return;
  }
  const expense = await createExpense(request, a, {
    amount: 1,
    description: 'Amicizia',
    participantPublicIds: [b.user.publicId],
  });
  const accepted = await request.post(`${API_URL}/friend/${a.user.publicId}/accept`, { headers: headers(b) });
  expect(accepted.status(), `${b.user.nickName} accetta ${a.user.nickName}`).toBe(204);
  const deleted = await request.delete(`${API_URL}/expense/${expense.publicId}`, { headers: headers(a) });
  expect(deleted.status(), 'eliminazione della spesa di appoggio').toBe(204);
}

/** Accetta l'invito in un gruppo: chi non era amico di chi l'ha aggiunto deve farlo per entrarci. */
export async function acceptGroup(
  request: APIRequestContext,
  session: Session,
  groupPublicId: string,
): Promise<void> {
  const response = await request.post(`${API_URL}/group/${groupPublicId}/accept`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(response.ok(), `${session.user.nickName} accetta il gruppo`).toBeTruthy();
}
