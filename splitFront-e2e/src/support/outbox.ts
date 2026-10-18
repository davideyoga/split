import { expect } from '@playwright/test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { MAIL_OUTBOX_DIR } from './env';

// L'API dei test non manda email: le scrive in MAIL_OUTBOX_DIR, un file per
// destinatario con l'ultima ricevuta (splitBack/src/app/mail/mail.service.ts).

function mailPath(email: string): string {
  return join(MAIL_OUTBOX_DIR, `${encodeURIComponent(email)}.json`);
}

/** Da chiamare prima di chiedere un codice, per non leggere quello di prima. */
export function clearMail(email: string): void {
  rmSync(mailPath(email), { force: true });
}

export function hasMail(email: string): boolean {
  return existsSync(mailPath(email));
}

/** Il testo dell'email, o null se il file non c'e' o e' ancora a meta'. */
function readMailText(email: string): string | null {
  try {
    return (JSON.parse(readFileSync(mailPath(email), 'utf8')) as { text: string }).text;
  } catch {
    return null;
  }
}

/**
 * Il codice di 6 cifre dell'ultima email ricevuta. L'invio e' asincrono e
 * `writeFile` crea il file vuoto prima di scriverlo: si aspetta un JSON
 * completo, non solo che il file esista.
 */
export async function readOtp(email: string): Promise<string> {
  await expect
    .poll(() => readMailText(email), { message: `email con il codice per ${email}` })
    .not.toBeNull();
  const text = readMailText(email) ?? '';
  const otp = /\b(\d{6})\b/.exec(text)?.[1];
  if (!otp) {
    throw new Error(`Nessun codice nell'email per ${email}: ${text}`);
  }
  return otp;
}
