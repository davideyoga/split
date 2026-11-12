import { expect, type APIRequestContext } from '@playwright/test';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_URL, PUSH_OUTBOX_DIR } from './env';
import type { Session } from './session';

// L'API dei test non manda push: le aggiunge al file del destinatario in
// PUSH_OUTBOX_DIR (splitBack/src/app/notification/push/push-sender.ts).

export interface FakeSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface OutboxPush {
  endpoint: string;
  payload: {
    notification: {
      title: string;
      body: string;
      lang: string;
      data: { url: string; onActionClick: { default: { operation: string; url: string } } };
    };
  };
}

/**
 * Un'iscrizione come quella di un browser vero: endpoint di FCM (nella lista
 * dei servizi accettati) e chiavi della lunghezza giusta. Nessuno la riceve:
 * l'outbox non contatta l'endpoint.
 */
export function fakeSubscription(): FakeSubscription {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${randomUUID()}`,
    keys: {
      p256dh: createECDH('prime256v1').generateKeys().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
}

export async function subscribePush(
  request: APIRequestContext,
  session: Session,
  subscription: FakeSubscription,
  locale: 'it' | 'en',
) {
  return request.post(`${API_URL}/notification/push/subscribe`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { ...subscription, locale },
  });
}

export async function unsubscribePush(request: APIRequestContext, session: Session, endpoint: string) {
  const response = await request.post(`${API_URL}/notification/push/unsubscribe`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { endpoint },
  });
  expect(response.status(), 'disiscrizione push').toBe(204);
}

/** Tutte le push ricevute da un utente; [] se non ne ha. Il file si scrive per intero (rename). */
export function readPushes(session: Session): OutboxPush[] {
  try {
    return JSON.parse(
      readFileSync(join(PUSH_OUTBOX_DIR, `${encodeURIComponent(session.user.publicId)}.json`), 'utf8'),
    ) as OutboxPush[];
  } catch {
    return [];
  }
}

/** Aspetta che un utente abbia ricevuto `count` push in tutto, e le restituisce. */
export async function waitForPushes(session: Session, count: number): Promise<OutboxPush[]> {
  await expect
    .poll(() => readPushes(session).length, { message: `push ricevute da ${session.user.nickName}` })
    .toBe(count);
  return readPushes(session);
}
