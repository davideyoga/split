# Notifiche push

Data: 2026-11-12. Stato: **fase 1 fatta** (Web Push per browser e PWA). Android e iOS nativi da fare (vedi "Fasi").

## Decisioni (dell'utente)

- **Canali separati, nessuna dipendenza da Google oltre l'inevitabile.** Ogni piattaforma usa il proprio canale standard:
  - **PWA e browser:** Web Push standard (chiavi VAPID), libreria `web-push` (MPL-2.0). Nessun account presso terzi.
  - **Android (Play Store):** FCM, l'unico canale che funziona senza far installare altro all'utente. Google entra solo qui.
  - **iOS (App Store):** APNs diretto. Serve l'Apple Developer Program, che serve comunque per pubblicare.
- **Scartato FCM come punto unico di invio** (il consiglio era: `@capacitor-firebase/messaging` + Firebase Admin SDK per tutti e tre i canali):
  - Google vedrebbe in chiaro il testo di tutte le notifiche, anche di iPhone e browser. Con Web Push diretto il testo è cifrato per il browser (RFC 8291) e il servizio di consegna non lo legge;
  - sul web servirebbe l'SDK di Firebase e un secondo service worker accanto a quello di Angular;
  - con un fornitore solo, una sua modifica ferma tutti i canali insieme (come lo spegnimento della vecchia API FCM nel 2024).
- **Scartati anche:** OneSignal e simili (piano gratis e poi a pagamento, dati presso un terzo); ntfy, Gotify e UnifiedPush (ogni utente dovrebbe installare un'altra app, e UnifiedPush non esiste su iOS); Gorush (server in più da tenere acceso, senza togliere FCM e APNs).
- **Tipi che diventano push:** `EXPENSE_ADDED`, `SETTLEMENT_ADDED`, `GROUP_JOINED`. Gli altri restano solo nella campanella. La lista è `PUSH_TYPES` in `push-text.ts`.
- **Lingua per dispositivo**, non per utente: la lingua dell'app è già per dispositivo (`split.lang` in localStorage). Per questo niente colonna `User.locale`, come invece prevedeva il vecchio TODO.

## Come funziona

### La tabella Notification fa da coda

Chi crea una notifica non sa niente delle push. `NotificationService.notify()` resta l'unico punto in cui nascono le notifiche, dentro la transazione dell'azione, e chiama solo `PushDispatcher.requestFlush()`.

1. `Notification.pushedAt` null vuol dire "da gestire". La migrazione `20261112120000_add_push` lo riempie per le righe esistenti, altrimenti al primo deploy partirebbe una push per tutta la cronologia.
2. `requestFlush()` segna la richiesta HTTP in corso. Lo stato vive in un `AsyncLocalStorage` (`push-request-state.ts`).
3. `PushFlushMiddleware` (su tutte le rotte di Nest) aspetta l'evento `close` della risposta. La risposta parte solo quando il servizio ha finito, quindi **dopo il commit**. A quel punto avvia `PushDispatcher.flush()` senza far aspettare il client.
4. `flush()` prende e segna con un'unica `updateManyAndReturn` tutte le righe con `pushedAt` null. Due giri (o due server) non mandano la stessa push due volte.
5. Per le righe dei tipi scelti e nate da meno di un'ora, carica gli stessi dati della campanella, scrive il testo nella lingua di ogni dispositivo del destinatario e manda.

Casi limite:

- **Transazione annullata:** le righe non sono mai esistite, e non parte niente.
- **Spesa cancellata nel frattempo:** la cascata ha già tolto la notifica.
- **Client che chiude la connessione prima della risposta:** il servizio può essere ancora a metà transazione, quindi si riprova dopo 6 s (il timeout delle transazioni interattive di Prisma è 5 s). Lo stesso succede se `notify()` viene chiamato fuori da una richiesta HTTP (uno script).
- **Server fermato fra commit e invio:** all'avvio (`onApplicationBootstrap`) il dispatcher manda le righe rimaste indietro, ma solo quelle con meno di un'ora. Le più vecchie si segnano senza mandarle.
- **Un giro alla volta per processo:** una richiesta di flush mentre ne gira uno lo fa ripetere alla fine.

Le regole di `notify()` valgono anche per le push, senza codice in più: chi fa l'azione non riceve niente, chi ha bloccato chi agisce nemmeno, e un account cancellato neppure.

**Alternative scartate per il "dopo il commit":**

- un hook di Prisma sulla creazione della riga scatta *prima* del commit;
- un trigger Postgres con `LISTEN/NOTIFY` arriva al commit, ma richiede un client Postgres a parte e una connessione sempre aperta;
- un `afterCommit` per ogni chiamante obbligherebbe spese, rimborsi e inviti a occuparsi delle push.

### Testi

Il testo lo genera il server, come l'email del codice (`push-text.ts`):

- titolo: `Split`, la costante `PUSH_TITLE` (se l'app cambia nome, va cambiata lì);
- corpo: **la stessa frase della campanella**, nella lingua del dispositivo;
- ripieghi come nel frontend: "Spesa senza descrizione", "Divisione intelligente", "Qualcuno", "Utente eliminato";
- importi formattati come `formatMoney` del frontend ("30,00 €" / "€30.00").

Le frasi esistono quindi in due copie, in `push-text.ts` e nei JSON del frontend, con le stesse chiavi. `push-text.spec.ts` legge `splitFront/src/assets/i18n/{it,en}.json` e fallisce se una frase non coincide. **Cambiare una frase vuol dire cambiarla nei due posti.** Nel DB non si salva testo generato.

### Il payload e il tocco

Il payload è nel formato del service worker di Angular (`ngsw-worker.js`), quindi non serve un service worker scritto a mano:

```json
{ "notification": { "title": "Split", "body": "…", "icon": "/icons/icon-192.png", "lang": "it",
  "data": { "url": "/tabs/activity/expense/<id>",
            "onActionClick": { "default": { "operation": "focusLastFocusedOrOpen", "url": "…" } } } } }
```

Al tocco, `focusLastFocusedOrOpen` porta in primo piano l'app se è aperta, oppure la apre direttamente su `url`.

- Con l'app aperta, `PushService` riceve `notificationClicks` e naviga con il router, senza ricaricare. Accetta solo percorsi interni (`safeReturnUrl`).
- Una push arrivata con l'app aperta aggiorna subito il numero sulla campanella (`swPush.messages`).
- Gli indirizzi sono gli stessi della pagina Notifiche: la spesa, i Saldi, il gruppo.

### Dispositivi (`PushDevice`)

Una riga per browser iscritto: `platform` (`web`; poi `android`/`ios`), `endpoint` (unico), chiavi `p256dh`/`auth`, `locale`.

- **Solo i servizi di consegna dei browser** (`push-endpoint.ts`):
  - host ammessi: `fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`, `*.push.apple.com`;
  - solo https, porta standard, niente credenziali nell'URL;
  - il motivo: il server fa una POST all'endpoint, e senza lista chiusa un utente potrebbe fargli chiamare indirizzi interni (SSRF);
  - un browser con un servizio non in lista riceve `400 PUSH_ENDPOINT_UNSUPPORTED`, e la lista va allargata.
- **Chiavi controllate:** 65 + 16 byte in base64url (`400 PUSH_KEYS_INVALID`). Con chiavi sbagliate ogni invio fallirebbe per sempre.
- **Lo stesso browser iscritto da un altro utente passa a lui:** su un dispositivo le push vanno a chi lo usa adesso.
- **Al massimo 10 dispositivi per utente:** oltre, esce quello aggiornato meno di recente.
- **Quando un dispositivo se ne va:**
  - al logout dal Profilo (`PushService.forgetDevice()` prima del `signOut`, col token ancora valido);
  - con la cancellazione dell'account (nella stessa transazione: la riga `User` resta, quindi la cascata non scatta);
  - quando il servizio di consegna risponde 404/410.
- **Contiene segreti:** `PushDevice` è in `SKIP_DATA` di `tools/db-snapshot/snapshot.mts`, quindi i dati non finiscono negli snapshot.

### Interruttori

| Livello | Dove | Come |
|---|---|---|
| Per dispositivo | Profilo → "Notifiche su questo dispositivo" | `POST /api/notification/push/subscribe` / `unsubscribe` |
| Per tipo | `PUSH_TYPES` in `push-text.ts` | Gli altri tipi restano nella campanella |
| Tutto | `PUSH_TRANSPORT=off` (default) | Nessuna push; le notifiche si segnano comunque come gestite, così riaccendendole non parte la coda |

Non c'è un endpoint per spegnere tutto: richiederebbe un ruolo di amministratore, che oggi non esiste.

### API (`NotificationController`, tutte con `SessionAuthGuard`)

- `GET /api/notification/push/config` → `{ vapidPublicKey }`. `null` = push spente sul server, e il Profilo non mostra la riga. La chiave arriva da qui e non da `environments/`, così c'è una sola fonte (le variabili del backend).
- `POST /api/notification/push/subscribe` `{ endpoint, keys: { p256dh, auth }, locale }` → `204`. Idempotente, e serve anche a cambiare la lingua.
- `POST /api/notification/push/unsubscribe` `{ endpoint }` → `204`. Toglie solo un dispositivo proprio. L'endpoint sta nel body e non nell'URL, così non finisce nei log di accesso.

### Frontend (`services/push.service.ts`)

- **Stati:** `loading`, `unavailable` (spente sul server: riga nascosta), `unsupported` (niente service worker, cioè in sviluppo e negli e2e, oppure iPhone senza l'app sulla schermata Home), `denied` (bloccate nel browser), `off`, `on`.
- **Il permesso si chiede solo dall'interruttore**, cioè da un tocco: Safari lo pretende, e chiederlo all'avvio sarebbe invadente.
- **`split.pushOwner` (localStorage)** ricorda di quale account è l'iscrizione del browser. Serve a due cose:
  - mostrare subito lo stato, perché il service worker può registrarsi fino a 30 s dopo l'avvio (`registerWhenStable:30000`);
  - togliere l'iscrizione rimasta di un altro utente, se il suo logout non è riuscito a farlo (offline).
- **Al logout** il browser si disiscrive. Il server toglie il dispositivo con `forgetDevice()`, oppure da solo al primo 410.
- **Ad ogni avvio** un'iscrizione propria si rimanda al server (lingua aggiornata, e il server la ritrova anche se l'aveva tolta). Lo stesso succede quando cambia la lingua e quando il browser rinnova l'iscrizione (`pushSubscriptionChanges`).

## Configurazione

| Variabile | Valore |
|---|---|
| `PUSH_TRANSPORT` | `off` (default) · `live` (invio vero) · `console` (solo log) · `outbox` (file per i test e2e) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Con `live`. Si generano una volta con `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | Con `live`: `mailto:` con un indirizzo vero, o un URL `https://`. Apple rifiuta i soggetti `localhost` (`403 BadJwtToken`) |
| `PUSH_OUTBOX_DIR` | Con `outbox` |

Con `live` e una variabile mancante o una chiave malformata il server non parte, come per le email.

**Le chiavi VAPID non vanno cambiate a cuor leggero:** i browser iscritti con la vecchia chiave smettono di ricevere. L'app si reiscrive solo quando l'utente riaccende l'interruttore.

**Su Render:** impostare le quattro variabili `PUSH_TRANSPORT=live`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (vedi `doc/DECISIONI_HOSTING.md`). Il frontend non ha bisogno di niente.

## Test

- **Jest:**
  - `push-text.spec.ts`: testi, indirizzi, ripieghi, formato degli importi, parità con i JSON del frontend;
  - `push-endpoint.spec.ts`: lista dei servizi, porte, credenziali, host sosia, chiavi;
  - `push.service.spec.ts` (frontend): stati, iscrizione, iscrizione di un altro utente, logout, cambio lingua, tocco.
- **Playwright, `push.spec.ts`:** l'API dei test gira con `PUSH_TRANSPORT=outbox` e le iscrizioni sono finte. Copre:
  - chi riceve e chi no, la lingua del dispositivo, i tipi esclusi;
  - il passaggio del browser a un altro utente e la disiscrizione;
  - gli endpoint e le chiavi rifiutati.

  Le push devono arrivare entro il timeout di `expect.poll` (5 s), che è più corto del ripiego da 6 s: se il flush a fine richiesta smettesse di funzionare, il test fallirebbe.
- **Non coperto:** il browser vero (service worker, permesso, notifica mostrata, tocco). In e2e il service worker non c'è.
- **Prova a mano:**
  - si fa sul sito pubblicato, con le variabili impostate su Render: Chrome su Android, poi un iPhone con Split sulla schermata Home;
  - in locale serve la build di produzione (`npx nx build splitFront`) servita su `localhost`, con `apiUrl` puntato all'API locale. Quella modifica non va committata;
  - l'origine va aggiunta ad `AUTH_TRUSTED_ORIGINS`, e nel `.env` servono `PUSH_TRANSPORT=live` e le chiavi VAPID.

## Limiti dell'alpha

- **Un invio fallito non si ritenta** (rete, servizio di consegna giù): la push è persa, la campanella resta. Un retry vorrebbe una colonna di tentativi.
- **TTL di 24 ore:** un telefono spento più a lungo non riceve le push vecchie.
- **Il lock "un giro alla volta" è per processo.** Con più istanze dell'API la `updateManyAndReturn` evita comunque i doppioni.
- **La lista dei servizi di consegna è chiusa:** un browser con un servizio nuovo non si iscrive finché non lo si aggiunge.
- **iPhone:** le push arrivano solo con l'app sulla schermata Home (iOS 16.4+). Non è verificato se nell'UE funzionino oggi per le PWA: va provato su un iPhone vero.
- **Testi in due copie** (backend e frontend), tenuti allineati dal test.

## Fasi

1. **Web Push per PWA e browser: fatta** (2026-11-12).
2. **Android (FCM):**
   - prerequisiti: Capacitor 8 (Play chiede target API 36 dal 31 agosto 2026; il repo è alla 6.2.1), un `appId` vero al posto di `io.ionic.starter`, la cartella `android/`;
   - nell'app il plugin ufficiale `@capacitor/push-notifications` (MIT), sul server `firebase-admin` (Apache-2.0);
   - stessa tabella `PushDevice` con `platform: 'android'`, e un trasporto in più in `PushSender`.
3. **iOS (APNs diretto):**
   - lo stesso plugin, che su iOS dà il token APNs; sul server `@parse/node-apn` (MIT) con la chiave `.p8`;
   - serve un Mac o una CI macOS (Xcode 26+);
   - va gestito l'ambiente di ogni token: sviluppo per le build da Xcode, produzione per TestFlight e App Store.
