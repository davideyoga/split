# Login con codice via email (Better Auth)

Login senza password: l'utente scrive la sua email, riceve un codice di 6 cifre e lo inserisce nell'app. Il sistema è pensato per essere **riusato in altri progetti** NestJS + Prisma + Angular/Ionic. Le decisioni e i dettagli specifici di Split sono in [CLAUDE.md](../CLAUDE.md), sezione **Auth**.

## Scelte

| Tema | Scelta | Perché |
|---|---|---|
| Libreria | [Better Auth](https://better-auth.com) 1.7.6, licenza MIT | Self-hosted (utenti e sessioni nel nostro Postgres), gratuita anche per uso commerciale, con plugin per OTP via email, passkey e social |
| Metodo | Codice di 6 cifre via email (plugin `emailOTP`) | Gratuito, a differenza degli SMS. Su mobile è più comodo del magic link, che aprirebbe il browser invece dell'app |
| Sessione | Token di sessione nel DB, mandato come `Authorization: Bearer` (plugin `bearer`) | Funziona uguale su web e Capacitor. 30 giorni, rinnovati a ogni giorno d'uso: niente refresh token da gestire |
| Email | `MailService` con trasporto a scelta: Brevo, console od outbox | Brevo è gratuito (circa 300 email al giorno) e usa solo `fetch`, niente SDK |
| Integrazione Nest | Handler montato a mano su Express più un guard nostro | Una dipendenza in meno rispetto a `@thallesp/nestjs-better-auth`, senza guard globale |

**Vincolo:** si usano solo dipendenze open source gratuite anche per uso commerciale. Prima di aggiungere un plugin, controllane la licenza.

## Come funziona

```
App                                   API (/api/auth/*, Better Auth)
 |-- POST email-otp/send-verification-otp {email, type:'sign-in'} -->  genera il codice, ne salva l'hash in Verification,
 |<------------------------------ 200 {success:true} -------------     MailService lo invia (senza attendere l'invio)
 |-- POST sign-in/email-otp {email, otp} -------------------------->  verifica (max 5 tentativi, 10 minuti)
 |<------------------------------ {token, user} -------------------   crea una riga in Session
 |-- GET /api/qualsiasi  (Authorization: Bearer <token>) --------->  SessionAuthGuard -> auth.api.getSession()
 |-- POST sign-out  (Bearer) -------------------------------------->  cancella la sessione
```

**Registrazione disabilitata:** un'email sconosciuta riceve la stessa risposta `200` ma nessun codice, e il login poi fallisce con `INVALID_OTP`. Così dall'esterno non si scopre chi è registrato. Per aprire le registrazioni basta impostare `disableSignUp: false`: Better Auth crea l'utente al primo login. Nel nostro schema servirebbe però un `nickName` da chiedere nell'app.

## File

**Backend**
- `splitBack/src/app/auth/auth.factory.ts`: tutta la configurazione di Better Auth. È il file da adattare.
- `splitBack/src/app/auth/session-auth.guard.ts` e `auth-user.ts`: il guard per le rotte protette.
- `splitBack/src/app/auth/auth.module.ts`: fornisce l'istanza (`BETTER_AUTH`) e il guard.
- `splitBack/src/app/auth/otp-email.ts`: testo dell'email in italiano e inglese.
- `splitBack/src/app/mail/`: `MailService` e `MailModule`. Non dipendono da nient'altro e si copiano così come sono.
- `splitBack/src/main.ts`: montaggio delle rotte `/api/auth/*`, con IP del client e rimozione dei cookie.
- `splitBack/prisma/schema.prisma`: `User` (con i campi di Better Auth), `Session`, `Account`, `Verification`.

**Frontend**
- `splitFront/src/app/services/auth.service.ts`: `requestCode`, `verifyCode`, `signOut` e la sessione in localStorage.
- `splitFront/src/app/services/auth.interceptor.ts`: aggiunge il Bearer e su un 401 riporta al login.
- `splitFront/src/app/services/auth.guard.ts`: blocca le rotte senza sessione.
- `splitFront/src/app/pages/login/`: la pagina in due passaggi, con le chiavi `login.*` in `en.json` e `it.json`.

## Portarlo in un altro progetto

1. `npm install better-auth@<versione> --save-exact`. Se npm risponde `ERESOLVE` per una dipendenza peer *opzionale* (in Split è successo con SvelteKit e Vite), aggiungi `--force`, non `--legacy-peer-deps`: quest'ultimo rimuove altri pacchetti.
2. **Schema:** aggiungi `Session`, `Account` e `Verification` copiandoli da `schema.prisma`. Alla tabella utenti servono `email` (unica), un nome, un booleano "email verificata", `image`, `createdAt` e `updatedAt`. Se i campi si chiamano diversamente, rimappali in `user.fields` dentro `auth.factory.ts`. Con id interi autoincrement usa `generateId: 'serial'`; con id stringa togli quell'opzione.
3. Copia `auth/` e `mail/`, poi adatta `appName`, `user.fields`, `additionalFields` e i testi di `otp-email.ts`.
4. In `main.ts` copia il blocco che monta `toNodeHandler(auth)`: va messo **dopo** `enableCors()` e **prima** di `app.listen()`, quindi prima del body parser di Nest.
5. Proteggi le rotte con `@UseGuards(SessionAuthGuard)` e leggi l'utente da `request.user`.
6. Frontend: copia i tre file di `services/` e la pagina di login.
7. Imposta le variabili d'ambiente elencate qui sotto.
8. Node deve essere alla versione **22.12 o successiva**: i pacchetti di Better Auth sono solo ESM e un backend CommonJS li carica con `require()`.

## Variabili d'ambiente

| Variabile | Obbligatoria | Note |
|---|---|---|
| `BETTER_AUTH_SECRET` | sì in produzione | Stringa casuale lunga. Cambiarla **non** chiude le sessioni esistenti: per farlo, svuota `Session` |
| `BETTER_AUTH_URL` | no | URL pubblico dell'API. Se manca, viene ricavato da ogni richiesta |
| `AUTH_TRUSTED_ORIGINS` | no | Origini del frontend, separate da virgole. Il default copre localhost e Capacitor. Un frontend pubblicato va aggiunto, altrimenti il login risponde `403 INVALID_ORIGIN` |
| `AUTH_RATE_LIMIT` | no | `off` disattiva il rate limit (solo per i test e2e) |
| `MAIL_TRANSPORT` | no | `brevo`, `console` (default) oppure `outbox` |
| `BREVO_API_KEY`, `MAIL_FROM` | con `brevo` | `MAIL_FROM` deve essere un mittente verificato in Brevo |
| `MAIL_FROM_NAME` | no | Default `Split` |
| `MAIL_OUTBOX_DIR` | con `outbox` | Cartella in cui scrivere le email |

## Configurare Brevo (senza dominio)

1. Crea un account gratuito su [brevo.com](https://www.brevo.com).
2. In **Senders, Domains & Dedicated IPs → Senders** aggiungi e verifica l'indirizzo mittente, per esempio il tuo Gmail. Brevo ti manda un'email di conferma.
3. In **SMTP & API → API keys** crea una chiave.
4. Nel `.env` imposta `MAIL_TRANSPORT=brevo`, `BREVO_API_KEY=...` e `MAIL_FROM=<mittente verificato>`, poi riavvia l'API.

**Limite:** con un mittente Gmail i controlli anti-spam (DMARC) penalizzano le email mandate da un servizio esterno, quindi i codici possono finire in spam. Si risolve con un dominio proprio, autenticato in Brevo (SPF e DKIM).

## Sicurezza: cosa è già coperto

- **Codici:** salvati solo come hash, validi 10 minuti, al massimo 5 tentativi, e ogni nuova richiesta invalida il codice precedente.
- **Rate limit per IP:** di default 3 invii di codice al minuto, poi `429`. L'IP arriva dal socket tramite l'header `x-split-client-ip`, che viene sempre sovrascritto, quindi un client non può falsificarlo. **Dietro un reverse proxy** va invece configurato `advanced.ipAddress.trustedProxies` (vedi TODO.md).
- **Solo Bearer, mai cookie:** il guard e le rotte `/api/auth/*` ignorano i cookie. Se fossero accettati, un cookie rimasto nel browser autenticherebbe da solo le richieste (CSRF) quando app e API stanno sullo stesso dominio.
- **Origine:** le chiamate di login fatte da un browser devono venire da un'origine in `AUTH_TRUSTED_ORIGINS`.
- **Nessuna enumerazione degli utenti:** un'email registrata e una sconosciuta ricevono la stessa risposta.
- **`/update-user` disabilitato:** permetterebbe di cambiare il nome senza le validazioni dell'app.

## Prossimi passi

- **Passkey** con `@better-auth/passkey` (MIT): accesso con impronta o FaceID dopo il primo login via codice. Su Capacitor serve un plugin nativo open source e la configurazione del dominio (`assetlinks.json` per Android, `apple-app-site-association` per iOS).
- Un dominio per le email.
- Rate limit su storage condiviso (`rateLimit.storage: 'database'`) se l'API gira su più processi.
