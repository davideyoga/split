import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL } from './env';

/**
 * Utenti creati da splitBack/prisma/seed.ts. Ogni file di test usa una coppia
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
  amelia: 'amelia@disney.test',
} as const;

export interface Session {
  accessToken: string;
  user: { publicId: string; nickName: string; email: string };
}

/** Login via API: lo stesso `POST /api/auth/login` (solo email) che usa l'app. */
export async function apiLogin(request: APIRequestContext, email: string): Promise<Session> {
  const response = await request.post(`${API_URL}/auth/login`, { data: { email } });
  expect(response.ok(), `login API di ${email}`).toBeTruthy();
  return response.json();
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

/** Crea una spesa via API, per i test che partono da dati già presenti. */
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
  },
): Promise<void> {
  const response = await request.post(`${API_URL}/expense`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: body,
  });
  expect(response.ok(), `creazione spesa ${JSON.stringify(body)}`).toBeTruthy();
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
