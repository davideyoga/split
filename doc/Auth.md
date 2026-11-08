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

**Registrazione** (2026-11-07), con l'interruttore `AUTH_SIGN_UP`:
- **`open`:** un'email sconosciuta riceve il codice come le altre, e il primo codice valido crea l'utente. Lo stesso vale per il primo accesso con Google o Apple.
- **Chiusa** (default, qualsiasi altro valore): un'email sconosciuta riceve la stessa risposta `200` ma nessun codice, e il login fallisce con `INVALID_OTP`. Google/Apple con un'email sconosciuta rispondono `403 SIGN_UP_DISABLED`; chi ha già un account entra lo stesso.
- In tutti e due i casi dall'esterno non si scopre chi è registrato: la risposta all'invio del codice è sempre la stessa.

Il nostro `User` vuole un `nickName` unico e valido già all'insert. Per questo l'hook `databaseHooks.user.create.before` (unico punto da cui passano tutte le registrazioni) assegna un **nickname provvisorio** e imposta `needsName = true`:
- da Google/Apple, il nome del profilo ripulito ("José Pérez" → `Jose.Perez`), se rispetta le regole ed è libero;
- altrimenti, e sempre per chi entra col codice, `user` + 8 cifre casuali.

Il frontend vede `needsName` nella risposta del login e manda alla pagina `/welcome`, dove si sceglie il nickname. `PATCH /api/user/me` lo rimette a `false`.

## Google e Apple

```
App                                         Google / Apple             API (Better Auth)
 |-- pulsante "Continua con Google/Apple" ---->|
 |<--------------------- ID token (JWT) -------|
 |-- POST sign-in/social {provider, idToken:{token}} ------------------->  verifica firma (JWKS del provider),
 |<---------------------------------------- {token, user} --------------   emittente, aud = nostro client ID, età < 1h
```

- **Solo ID token, niente redirect OAuth.** Il redirect porta lo stato in un cookie, e qui i cookie non passano (Bearer only). Col token il login risponde `{ token, user }` come quello col codice, e basta il **client ID**, senza secret. `POST sign-in/social` senza `idToken` risponde `400 ID_TOKEN_REQUIRED`.
- **Frontend:**
  - Google usa Google Identity Services, che disegna il proprio pulsante (iframe, regole del marchio);
  - Apple usa Sign in with Apple JS in modalità popup, con un nostro pulsante nero secondo le loro linee guida;
  - gli script si caricano solo sulla pagina di login (`services/social-sign-in.service.ts`);
  - un provider senza client ID in `environment` non mostra il pulsante.
- **Collegamento per email:** chi ha già un account (creato col codice o da `add-users.mts`) ed entra con Google/Apple con la **stessa email** ritrova il suo utente, e Better Auth aggiunge una riga in `Account`. Vale anche al contrario: chi si è registrato con Google può entrare col codice, che si basa solo sull'email. Il collegamento richiede che l'email sia **verificata da entrambe le parti**:
  - dal provider: `email_verified` nel token. Nessun provider è in `trustedProviders`, che salterebbe questo controllo;
  - da noi: `User.confirmed`, con `requireLocalEmailVerified`.

  Senza la seconda condizione, chi registra per primo l'email di un altro senza verificarla si troverebbe dentro l'account Google della vittima. Se una delle due manca, il login risponde `401 OAUTH_LINK_ERROR` "account not linked", e l'app consiglia di entrare una volta col codice (che conferma l'email).
- Il nome del provider **non sovrascrive mai** il nickname scelto (`updateUserInfoOnLink: false`).
- **Apple con "Nascondi la mia email"** dà un indirizzo `@privaterelay.appleid.com`, che non coincide con quello usato col codice: nasce un secondo account (vedi TODO.md). Apple manda il nome solo al primo accesso, e non nel token: l'app lo passa in `idToken.user`.
- **Pitfall (Better Auth 1.7.6):** l'opzione `disableSignUp` dei provider social **non vale** per il login via ID token (`sign-in.mjs` legge `provider.disableSignUp`, che non viene mai impostato), e `disableImplicitSignUp` si salta mandando `requestSignUp: true`. Per questo la registrazione chiusa la impone l'hook di creazione utente, con un `APIError` 403.
- **Solo web/PWA per ora.** Nella WebView di Capacitor Google rifiuta il login (`disallowed_useragent`): per l'app nativa servono plugin che restituiscano l'ID token, e i client ID nativi aggiunti alle variabili qui sotto (TODO.md).

### Configurare Google (gratuito)

1. [Google Cloud Console](https://console.cloud.google.com) → crea un progetto → **APIs & Services → OAuth consent screen**: tipo *External*, nome dell'app ed email di supporto. Finché resta in modalità *Testing* entrano solo gli utenti di test elencati lì (massimo 100). Per pubblicarla servono un'informativa privacy e la home page dell'app.
2. **Credentials → Create credentials → OAuth client ID → Web application**. In *Authorized JavaScript origins* metti le origini del frontend: l'URL pubblicato e, per lo sviluppo, sia `http://localhost` sia `http://localhost:4200` (Google lo chiede per localhost). Non servono redirect URI.
3. Copia il **Client ID** in `GOOGLE_CLIENT_ID` (backend) e in `googleClientId` di `splitFront/src/environments/environment*.ts` (frontend), poi riavvia l'API.

### Configurare Apple (serve l'Apple Developer Program, 99 $/anno)

1. In [developer.apple.com](https://developer.apple.com/account) → **Identifiers**: un *App ID* con la capability *Sign in with Apple*, poi un *Services ID* (es. `com.example.split.web`) collegato a quell'App ID.
2. Nel Services ID, *Sign in with Apple → Configure*: il dominio del frontend e un *Return URL* **https** sulla stessa origine (es. `https://app.example.com/login`). Apple **non accetta localhost**: in locale si prova solo con un tunnel https.
3. Il Services ID va in `APPLE_CLIENT_ID` (backend) e in `appleClientId` (frontend), il Return URL in `appleRedirectUri` (frontend). Col popup Apple non naviga su quel URL, ma lo vuole registrato.
4. Non servono la chiave `.p8` né il client secret: si usano solo per il redirect OAuth.

L'App Store chiede "Sign in with Apple" alle app iOS che offrono un login social: se un giorno l'app iOS avrà Google, dovrà avere anche Apple.

### Verifica

Google e Apple non si possono provare nell'e2e, perché servono token firmati da loro. Il 2026-11-07 la configurazione di `auth.factory.ts` è stata provata contro un database di test, sostituendo solo la verifica della firma del token. Esiti, tutti come atteso:
- un'email esistente si collega e conserva il nickname, con una riga in `Account`;
- un secondo accesso non crea nuove righe;
- un'email non verificata dal provider o un utente non `confirmed` vengono rifiutati;
- un utente nuovo nasce con `Jose.Perez` o `user` + 8 cifre e `needsName`;
- chi si è registrato con Google entra poi col codice;
- con la registrazione chiusa: `403 SIGN_UP_DISABLED` e nessun codice inviato.

## File

**Backend**
- `splitBack/src/app/auth/auth.factory.ts`: tutta la configurazione di Better Auth (registrazione, Google/Apple, collegamento per email). È il file da adattare.
- `splitBack/src/app/auth/provisional-nickname.ts`: il nickname provvisorio di chi si registra. È specifico di Split: in un altro progetto senza nome unico obbligatorio non serve.
- `splitBack/src/app/auth/session-auth.guard.ts` e `auth-user.ts`: il guard per le rotte protette.
- `splitBack/src/app/auth/auth.module.ts`: fornisce l'istanza (`BETTER_AUTH`) e il guard.
- `splitBack/src/app/auth/otp-email.ts`: testo dell'email in italiano e inglese.
- `splitBack/src/app/mail/`: `MailService` e `MailModule`. Non dipendono da nient'altro e si copiano così come sono.
- `splitBack/src/main.ts`: montaggio delle rotte `/api/auth/*`, con IP del client e rimozione dei cookie.
- `splitBack/prisma/schema.prisma`: `User` (con i campi di Better Auth), `Session`, `Account`, `Verification`.

**Frontend**
- `splitFront/src/app/services/auth.service.ts`: `requestCode`, `verifyCode`, `signInWithIdToken`, `signOut` e la sessione in localStorage.
- `splitFront/src/app/services/social-sign-in.service.ts`: pulsante di Google e popup di Apple, che restituiscono l'ID token.
- `splitFront/src/app/services/auth.interceptor.ts`: aggiunge il Bearer e su un 401 riporta al login.
- `splitFront/src/app/services/auth.guard.ts`: blocca le rotte senza sessione e manda su `/welcome` chi ha ancora il nickname provvisorio (`welcomeGuard` per la pagina stessa).
- `splitFront/src/app/pages/login/`: la pagina in due passaggi più Google/Apple, con le chiavi `login.*` in `en.json` e `it.json`.
- `splitFront/src/app/pages/welcome/`: la scelta del nickname dopo la registrazione (`welcome.*`).
- `splitFront/src/environments/`: `googleClientId`, `appleClientId`, `appleRedirectUri`.

## Portarlo in un altro progetto

1. `npm install better-auth@<versione> --save-exact`. Se npm risponde `ERESOLVE` per una dipendenza peer *opzionale* (in Split è successo con SvelteKit e Vite), aggiungi `--force`, non `--legacy-peer-deps`: quest'ultimo rimuove altri pacchetti.
2. **Schema:** aggiungi `Session`, `Account` e `Verification` copiandoli da `schema.prisma`. Alla tabella utenti servono `email` (unica), un nome, un booleano "email verificata", `image`, `createdAt` e `updatedAt`. Se i campi si chiamano diversamente, rimappali in `user.fields` dentro `auth.factory.ts`. Con id interi autoincrement usa `generateId: 'serial'`; con id stringa togli quell'opzione.
3. Copia `auth/` e `mail/`, poi adatta `appName`, `user.fields`, `additionalFields` e i testi di `otp-email.ts`.
4. In `main.ts` copia `app.enableCors({ origin: trustedOrigins() })` e il blocco che monta `toNodeHandler(auth)`: quest'ultimo va messo **dopo** `enableCors()` e **prima** di `app.listen()`, quindi prima del body parser di Nest.
5. Proteggi le rotte con `@UseGuards(SessionAuthGuard)` e leggi l'utente da `request.user`.
6. Frontend: copia i tre file di `services/` e la pagina di login.
7. Imposta le variabili d'ambiente elencate qui sotto.
8. Node deve essere alla versione **22.12 o successiva**: i pacchetti di Better Auth sono solo ESM e un backend CommonJS li carica con `require()`.

## Variabili d'ambiente

| Variabile | Obbligatoria | Note |
|---|---|---|
| `BETTER_AUTH_SECRET` | sì in produzione | Stringa casuale lunga. Cambiarla **non** chiude le sessioni esistenti: per farlo, svuota `Session` |
| `BETTER_AUTH_URL` | no | URL pubblico dell'API. Se manca, viene ricavato da ogni richiesta |
| `AUTH_TRUSTED_ORIGINS` | no | Origini del frontend, separate da virgole. Il default copre localhost e Capacitor. Vale per il login **e per CORS su tutta l'API**: un frontend pubblicato va aggiunto, altrimenti il login risponde `403 INVALID_ORIGIN` e il browser blocca le altre chiamate |
| `AUTH_RATE_LIMIT` | no | `off` disattiva il rate limit (solo per i test e2e) |
| `AUTH_TRUSTED_PROXIES` | dietro un proxy | IP o range CIDR dei reverse proxy, separati da virgole. Senza, il rate limit usa l'IP del socket e ignora `X-Forwarded-For` |
| `AUTH_SIGN_UP` | no | `open` apre la registrazione (codice, Google, Apple). Default: chiusa |
| `GOOGLE_CLIENT_ID` | no | Client ID OAuth "Web application"; più ID separati da virgola (web + app native). Senza, niente Google |
| `APPLE_CLIENT_ID` | no | Services ID del web. Senza (e senza il bundle), niente Apple |
| `APPLE_APP_BUNDLE_IDENTIFIER` | no | Bundle dell'app iOS, quando ci sarà: Apple lo mette in `aud` dei token nativi |
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
- **Rate limit per IP:** di default 3 invii di codice al minuto, poi `429`. L'IP arriva dal socket tramite l'header `x-split-client-ip`, che viene sempre sovrascritto, quindi un client non può falsificarlo. **Dietro un reverse proxy** va impostato `AUTH_TRUSTED_PROXIES`: `main.ts` passa allora la catena `X-Forwarded-For` con in fondo l'IP del socket, e Better Auth la legge da destra fermandosi al primo indirizzo non fidato, quindi i valori inventati da un client a sinistra non contano (`auth/client-ip.ts`). Da quel momento la colonna `Session.ipAddress` contiene l'IP vero dell'utente, non quello del proxy: è un dato personale da citare nell'informativa privacy.
- **Solo Bearer, mai cookie:** il guard e le rotte `/api/auth/*` ignorano i cookie. Se fossero accettati, un cookie rimasto nel browser autenticherebbe da solo le richieste (CSRF) quando app e API stanno sullo stesso dominio.
- **Origine:** le chiamate di login fatte da un browser devono venire da un'origine in `AUTH_TRUSTED_ORIGINS`. La stessa lista è quella di CORS: solo quelle origini possono leggere le risposte dell'API da un browser.
- **Nessuna enumerazione degli utenti:** un'email registrata e una sconosciuta ricevono la stessa risposta. Dall'interno, la ricerca esatta per email lo rivela una email alla volta: per questo `GET /api/user` ha un limite di 30 ricerche all'ora per utente (`429 SEARCH_RATE_LIMITED`).
- **Login social:** solo ID token firmati dal provider, con `aud` uguale a un nostro client ID, emessi da meno di un'ora. Collegamento per email solo con l'email verificata da entrambe le parti (vedi "Google e Apple").
- **`/update-user` disabilitato:** permetterebbe di cambiare il nome senza le validazioni dell'app. Il nickname si cambia solo con `PATCH /api/user/me` (regole in `splitBack/src/app/user/nickname.ts`, vedi CLAUDE.md, "Nickname").

## Prossimi passi

- **Passkey** con `@better-auth/passkey` (MIT): accesso con impronta o FaceID dopo il primo login via codice. Su Capacitor serve un plugin nativo open source e la configurazione del dominio (`assetlinks.json` per Android, `apple-app-site-association` per iOS).
- Un dominio per le email.
- Rate limit su storage condiviso (`rateLimit.storage: 'database'`) se l'API gira su più processi.
