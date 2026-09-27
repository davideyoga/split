import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, emailOTP } from 'better-auth/plugins';
import type { PrismaClient } from '@prisma/client';
import type { MailService } from '../mail/mail.service';
import { otpEmail, pickLang } from './otp-email';

/** Token di iniezione dell'istanza Better Auth (vedi AuthModule). */
export const BETTER_AUTH = Symbol('BETTER_AUTH');

/**
 * Header in cui main.ts mette l'IP del socket prima di passare la richiesta a
 * Better Auth. TODO before beta: dietro un reverse proxy l'IP del socket e'
 * quello del proxy (tutti i client in un solo contatore del rate limit):
 * leggere allora X-Forwarded-For con `advanced.ipAddress.trustedProxies`.
 */
export const CLIENT_IP_HEADER = 'x-split-client-ip';

const DAY = 60 * 60 * 24;
const OTP_EXPIRES_IN = 10 * 60;

/**
 * Origini da cui il browser puo' chiamare le rotte di login (controllo CSRF di
 * Better Auth sulle richieste con header Origin/Sec-Fetch-*). Default: dev
 * server (4200), stack e2e (4300) e WebView di Capacitor su Android
 * (https://localhost) e iOS (capacitor://localhost).
 */
function trustedOrigins(): string[] {
  const fromEnv = process.env['AUTH_TRUSTED_ORIGINS'];
  if (fromEnv) {
    return fromEnv.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return ['http://localhost:4200', 'http://localhost:4300', 'https://localhost', 'capacitor://localhost'];
}

/**
 * Configurazione di Better Auth: login senza password con un codice di 6 cifre
 * via email (plugin emailOTP), sessione passata come Bearer token (plugin
 * bearer), dati nel nostro Postgres via Prisma. Il segreto e' BETTER_AUTH_SECRET,
 * letto da Better Auth stesso.
 */
export function createAuth(prisma: PrismaClient, mail: MailService) {
  return betterAuth({
    appName: 'Split',
    basePath: '/api/auth',
    baseURL: process.env['BETTER_AUTH_URL'],
    trustedOrigins: trustedOrigins(),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    advanced: {
      // Id interi autoincrement, come il resto dello schema.
      database: { generateId: 'serial' },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    telemetry: { enabled: false },
    // La tabella `user` di Better Auth e' il nostro User: si rimappano i nomi
    // dei campi invece di duplicare gli utenti in una seconda tabella.
    user: {
      modelName: 'user',
      fields: {
        name: 'nickName',
        emailVerified: 'confirmed',
        createdAt: 'createdDate',
      },
      additionalFields: {
        // Generato dal DB (@default(uuid())), mai scrivibile dal client.
        publicId: { type: 'string', required: false, input: false },
      },
    },
    session: {
      // 30 giorni, prolungati di altri 30 al primo uso di ogni giorno: chi usa
      // l'app non deve rifare il login (e' il "refresh token" che mancava).
      expiresIn: 30 * DAY,
      updateAge: DAY,
    },
    // update-user permetterebbe di cambiare `name` (= nickName) senza le
    // nostre validazioni.
    disabledPaths: ['/update-user'],
    rateLimit: {
      // Di default Better Auth lo attiva solo con NODE_ENV=production; qui
      // sempre, tranne che nei test e2e (AUTH_RATE_LIMIT=off), dove tanti login
      // partono dallo stesso IP nello stesso minuto.
      enabled: process.env['AUTH_RATE_LIMIT'] !== 'off',
    },
    plugins: [
      bearer(),
      emailOTP({
        // Alpha: entra solo chi e' gia' nel DB (seed.ts). Un'email sconosciuta
        // riceve la stessa risposta "ok" ma nessun codice, e il login fallisce
        // con INVALID_OTP: dall'esterno non si scopre chi e' registrato.
        disableSignUp: true,
        otpLength: 6,
        expiresIn: OTP_EXPIRES_IN,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        // Non attesa (lo raccomanda Better Auth, per non rivelare con i tempi di
        // risposta se l'email esiste): un errore di invio finisce solo nel log.
        sendVerificationOTP: async ({ email, otp }, ctx) => {
          const lang = pickLang(ctx?.request?.headers.get('accept-language'));
          mail.send(otpEmail(email, otp, lang, OTP_EXPIRES_IN / 60)).catch((error: unknown) => {
            console.error(`Invio del codice di accesso a ${email} fallito`, error);
          });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
