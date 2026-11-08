import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { bearer, emailOTP } from 'better-auth/plugins';
import type { PrismaClient } from '@prisma/client';
import type { MailService } from '../mail/mail.service';
import { otpEmail, pickLang } from './otp-email';
import { provisionalNickname } from './provisional-nickname';

/** Token di iniezione dell'istanza Better Auth (vedi AuthModule). */
export const BETTER_AUTH = Symbol('BETTER_AUTH');

/**
 * Header in cui main.ts mette l'IP del client prima di passare la richiesta a
 * Better Auth: l'IP del socket, preceduto da X-Forwarded-For solo se
 * AUTH_TRUSTED_PROXIES dice che siamo dietro un proxy (vedi client-ip.ts). Lo
 * sovrascrive sempre main.ts: un valore mandato dal client non conta.
 */
export const CLIENT_IP_HEADER = 'x-split-client-ip';

const DAY = 60 * 60 * 24;
const OTP_EXPIRES_IN = 10 * 60;

/**
 * Origini del frontend: le uniche da cui il browser puo' chiamare le rotte di
 * login (controllo CSRF di Better Auth sulle richieste con header
 * Origin/Sec-Fetch-*) e, via CORS (main.ts), il resto dell'API. Default: dev
 * server (4200), stack e2e (4300) e WebView di Capacitor su Android
 * (https://localhost) e iOS (capacitor://localhost).
 */
export function trustedOrigins(): string[] {
  const fromEnv = process.env['AUTH_TRUSTED_ORIGINS'];
  if (fromEnv) {
    return fromEnv.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return ['http://localhost:4200', 'http://localhost:4300', 'https://localhost', 'capacitor://localhost'];
}

/**
 * AUTH_SIGN_UP=open: chi non ha un account se lo crea al primo login (codice
 * via email, Google o Apple). Qualsiasi altro valore, o niente: entra solo chi
 * e' gia' nel DB (seed.ts, add-users.mts), come nell'alpha. Chiusa di default
 * perche' un deploy che se ne dimentica resti chiuso: prima di aprirla davvero
 * serve l'informativa privacy pubblicata nell'app (vedi TODO.md).
 */
export function signUpOpen(): boolean {
  return process.env['AUTH_SIGN_UP'] === 'open';
}

function listFromEnv(name: string): string[] {
  return (process.env[name] ?? '').split(',').map((v) => v.trim()).filter(Boolean);
}

/**
 * IP o range CIDR dei reverse proxy davanti all'API, per il rate limit per IP.
 * Vuota (default): nessun proxy, conta l'IP del socket. Il valore per Render e'
 * in doc/DECISIONI_HOSTING.md. Un range mancante non apre buchi: quell'hop viene
 * preso per il client, e chi passa da li' condivide un contatore.
 */
export function trustedProxies(): string[] {
  return listFromEnv('AUTH_TRUSTED_PROXIES');
}

/**
 * Login con Google e Apple, solo via ID token: il frontend ottiene il token dal
 * provider (Google Identity Services, Sign in with Apple JS in popup) e lo
 * manda a POST /api/auth/sign-in/social `{ provider, idToken: { token } }`;
 * Better Auth ne verifica firma, emittente, scadenza e destinatario (`aud` =
 * uno dei nostri client ID) e risponde `{ token, user }` come il login col
 * codice. Niente redirect OAuth: il suo stato viaggia in un cookie, e qui i
 * cookie non passano (main.ts). Per questo basta il client ID, senza secret.
 *
 * Un provider senza variabili d'ambiente resta spento. Piu' ID separati da
 * virgola: quello web piu', domani, quelli delle app native (Android/iOS
 * firmano i token con un `aud` diverso).
 */
function socialProviders() {
  const google = listFromEnv('GOOGLE_CLIENT_ID');
  // APPLE_CLIENT_ID e' il Services ID del web, APPLE_APP_BUNDLE_IDENTIFIER il
  // bundle dell'app iOS: Apple mette l'uno o l'altro in `aud`.
  const apple = [...listFromEnv('APPLE_CLIENT_ID'), ...listFromEnv('APPLE_APP_BUNDLE_IDENTIFIER')];
  return {
    ...(google.length > 0 ? { google: { clientId: google } } : {}),
    ...(apple.length > 0 ? { apple: { clientId: apple[0], audience: apple } } : {}),
  };
}

/**
 * Configurazione di Better Auth: login senza password con un codice di 6 cifre
 * via email (plugin emailOTP) o con Google/Apple, sessione passata come Bearer
 * token (plugin bearer), dati nel nostro Postgres via Prisma. Il segreto e'
 * BETTER_AUTH_SECRET, letto da Better Auth stesso.
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
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER], trustedProxies: trustedProxies() },
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
        // Lo mette a true solo l'hook di creazione qui sotto; il frontend lo
        // legge dalla risposta del login per mandare su /welcome.
        needsName: { type: 'boolean', required: false, input: false },
      },
    },
    socialProviders: socialProviders(),
    account: {
      // Collegamento per email: chi ha gia' un account (creato col codice o da
      // add-users.mts) ed entra con Google/Apple con la stessa email ritrova il
      // suo utente, e Better Auth gli aggiunge una riga Account. Vale anche al
      // contrario: chi si e' registrato con Google entra poi col codice, che si
      // basa solo sull'email.
      // Solo se l'email e' verificata da entrambe le parti: dal provider
      // (`email_verified` nel token; nessun provider e' in trustedProviders, che
      // salterebbe il controllo) e da noi (`confirmed`, requireLocalEmailVerified).
      // Senza il secondo, chi registra prima l'email di un altro senza
      // verificarla si troverebbe dentro l'account Google della vittima.
      accountLinking: {
        enabled: true,
        requireLocalEmailVerified: true,
        // Il nome del provider non sovrascrive mai il nickname scelto.
        updateUserInfoOnLink: false,
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
    hooks: {
      // Social solo via ID token (vedi socialProviders): senza, Better Auth
      // avvierebbe il redirect OAuth, che qui non puo' funzionare.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-in/social' && !ctx.body?.idToken) {
          throw new APIError('BAD_REQUEST', { code: 'ID_TOKEN_REQUIRED', message: 'ID_TOKEN_REQUIRED' });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Unico punto da cui passano tutte le registrazioni (codice, Google,
          // Apple). La chiusura si controlla qui e non con `disableSignUp` dei
          // provider social: in Better Auth 1.7.6 il login via ID token non lo
          // legge. Un APIError arriva al client cosi' com'e' (403).
          before: async (user) => {
            if (!signUpOpen()) {
              throw new APIError('FORBIDDEN', { code: 'SIGN_UP_DISABLED', message: 'SIGN_UP_DISABLED' });
            }
            return { data: { name: await provisionalNickname(prisma, user.name), needsName: true } };
          },
        },
      },
    },
    rateLimit: {
      // Di default Better Auth lo attiva solo con NODE_ENV=production; qui
      // sempre, tranne che nei test e2e (AUTH_RATE_LIMIT=off), dove tanti login
      // partono dallo stesso IP nello stesso minuto.
      enabled: process.env['AUTH_RATE_LIMIT'] !== 'off',
    },
    plugins: [
      bearer(),
      emailOTP({
        // Registrazione aperta: anche un'email sconosciuta riceve il codice, e
        // il primo codice valido crea l'utente (nickname provvisorio, vedi
        // databaseHooks). Chiusa: un'email sconosciuta riceve la stessa
        // risposta "ok" ma nessun codice, e il login fallisce con INVALID_OTP.
        // In tutti e due i casi dall'esterno non si scopre chi e' registrato.
        disableSignUp: !signUpOpen(),
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
