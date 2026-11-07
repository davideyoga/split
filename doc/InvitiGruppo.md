# Gruppi via link, niente amici, blocco

Data: 2026-10-25, rivisto il 2026-11-07. Stato: **implementato** (2026-11-07): fasi A, B, C e D fatte; la D viene dal branch `registration`. Restano gli ospiti, estensione futura. Le decisioni dell'utente sono indicate come tali. Il resto è una proposta, adottata salvo diversa indicazione.

## Perché

Il 2026-10-25 sono arrivati gli **amici** (commit `4d7a9eb`): una spesa con chi non è amico restava in attesa finché non la accettava, e aggiungere a un gruppo chi non era amico gli mandava un invito. Funzionava, ma chiedeva un consenso a ogni passo e rendeva tutto complicato: richieste per persona, rifiuti che spostano quote e pagatore, inviti, accettazioni che sbloccano spese a catena.

Gli altri fanno così:

- **Splitwise:** nessun consenso. Chiunque abbia la tua email ti aggiunge a una spesa o a un gruppo, e tu ricevi una notifica. Contro gli abusi c'è "blocca".
- **Tricount:** nessuno ti mette in un gruppo. Ci entri tu, aprendo il link.

Il problema vero era uno solo: **essere messi in un gruppo da altri**. Il link d'invito, già pianificato, lo risolve senza amici.

## Decisioni dell'utente

1. **Nei gruppi si entra solo con il link** (2026-11-07). Nessuno può aggiungere un'altra persona a un gruppo. Sostituisce la vecchia decisione "il link sostituisce la ricerca": la ricerca resta, ma solo per le spese.
2. **Niente amici né richieste da accettare** (2026-11-07), come Splitwise. Chi conosce il tuo nickname o la tua email ti aggiunge a una spesa, e tu ricevi la notifica. Gli amici del 2026-10-25 si tolgono.
3. **"Blocca" ed "Esci dal gruppo"** (2026-11-07) servono contro gli abusi.
4. Il link ha una **scadenza**: 1, 7 o 30 giorni, **7 di default**.
5. Un gruppo ha **un solo link attivo**: generarne uno nuovo revoca il precedente.
6. **Per ora il link funziona solo per utenti registrati.** Chi non ha l'account si registra passando dal link stesso (dopo la fase D).
7. **Nessun "congelamento" delle spese.** Chi entra con il link è un membro come gli altri e può modificare tutte le spese del gruppo. Entra nella ripartizione di una spesa di gruppo alla modifica successiva, come oggi.
8. La **registrazione** sarà **aperta a chiunque** (fase D). Il **captcha** è rimandato.
9. **Ospiti senza account**: estensione futura, non pianificata (vedi in fondo).

## Piano

Ogni fase si chiude con le verifiche di CLAUDE.md (type check, build, lint, e2e) e con CLAUDE.md e TODO.md aggiornati.

### Fase A: togliere gli amici (fatta, 2026-11-07)

Migrazione `20261107120000_remove_friends`. Test e2e: 19 su 19, con due test nuovi sui contatti in `participant-search.spec.ts`.

Si tengono la **ricerca esatta** e le **notifiche** del 2026-10-25. Si toglie tutto il resto.

**Database** (nuova migrazione `remove_friends`, perché `add_friends` è già applicata sui DB di sviluppo):
- si cancellano gli inviti ai gruppi mai accettati (`UserOnGroup.pending = true`): quelle persone non sono mai entrate;
- le quote in attesa diventano quote normali, come se fossero state accettate: per tutti gli altri contavano già;
- si cancellano le notifiche dei tipi che spariscono;
- si eliminano la tabella `Friendship` e le colonne `pending` / `invitedById` di `ExpenseContribution` e `UserOnGroup`.

**Backend:**
- via il modulo `friend/` (`GET /api/friend`, `GET /api/friend/requests`, `POST /api/friend/:publicId/accept`);
- via `POST /api/expense/:publicId/reject`, `POST /api/group/:publicId/accept` e `/decline`, e il campo `invited` dei gruppi;
- chi viene aggiunto a una spesa o a un gruppo ci entra subito, con la notifica `EXPENSE_ADDED` / `GROUP_ADDED` come prima degli amici. L'aggiunta ai gruppi resta solo fino alla fase B;
- via i tipi di notifica `EXPENSE_PENDING`, `EXPENSE_REJECTED`, `FRIEND_ACCEPTED`, `GROUP_INVITED`, `GROUP_JOINED`, `GROUP_DECLINED`;
- nuovo **`GET /api/user/contacts`**: le persone con cui condividi già un gruppo o una spesa, per nickname. Prende il posto dell'elenco amici nella scelta dei partecipanti, come i "friends" automatici di Splitwise.

**Frontend:**
- scelta partecipanti: elenco dei contatti, più la ricerca esatta. Niente più "Non ancora amico";
- via la sezione Richieste delle Notifiche, il banner Accetta/Rifiuta e "In attesa che accetti" nel dettaglio spesa, la card "N spese da accettare" in Attività, "N inviti" nei gruppi, "Invito in attesa" fra i membri, e l'avviso "Non ancora amici" nel form;
- via `isPendingFor`: saldi e spese mensili tornano a contare tutto.

**E2E:** via `friends.spec.ts` e gli helper `makeFriends` / `acceptGroup`. Si adattano `notifications.spec.ts`, `participant-search.spec.ts` e le altre spec che li usano.

### Fase B: link d'invito, e via l'aggiunta di membri (fatta, 2026-11-07)

Migrazione `20261107130000_add_group_invite`. Test: Jest su `invite-token.ts` (backend) e `utils/invite.ts` (frontend); Playwright in `invite.spec.ts` (API, percorso `/join` → login → ritorno → Unisciti, link revocato) e `group.spec.ts` (link creato dalla UI). Differenze rispetto al piano qui sotto:

- il link sta in fondo al segmento **Membri** del gruppo (non nelle impostazioni), e il gruppo appena creato si apre li' (`?segment=members`);
- in piu' c'e' `GET /api/group/:publicId/invite`, che dice se c'e' un link attivo e fino a quando, senza il token;
- l'anteprima conosce chi chiama se ha una sessione (`OptionalSessionAuthGuard`): a chi e' gia' membro risponde `alreadyMember` e il gruppo;
- `GROUP_ADDED` non si crea piu', ma le notifiche vecchie restano leggibili;
- **limite:** il link usa l'origine della pagina, che nell'app nativa (Capacitor) e' `https://localhost`.


**Database:** tabella `GroupInvite` e `UserOnGroup.inviteId` (vedi [Il link](#il-link)).

**Backend:**
- `POST /api/group/:publicId/invite` `{ expiresInDays }` e `DELETE /api/group/:publicId/invite`;
- `POST /api/invite/preview` `{ token }`, pubblica, e `POST /api/invite/join` `{ token }`, con sessione;
- `POST /api/group` prende solo `{ name }`, e `POST /api/group/:publicId/members` sparisce. La rimozione di un membro resta;
- notifica: `GROUP_ADDED` sparisce, perché nessuno viene più aggiunto. Arriva `GROUP_JOINED` ("Marco è entrato in Lisbona"), mandata a **tutti i membri**: chi entra vede tutto lo storico, quindi chi non lo conosce deve poterlo togliere.

**Frontend:**
- pagina `/join`;
- nelle impostazioni del gruppo, "Invita con link" (scadenza, condivisione o copia) e "Revoca link" al posto di "Aggiungi membro";
- il modale "Nuovo gruppo" chiede solo il nome, poi propone di invitare;
- un pulsante "Invita" anche nel segmento Membri.

**E2E:** un helper che fa entrare un utente in un gruppo via API (crea il link e fa `join`), al posto dell'aggiunta di membri nelle spec esistenti, più una spec nuova `invite.spec.ts`.

### Fase C: Blocca ed Esci dal gruppo (fatta, 2026-11-07)

Migrazione `20261107140000_add_user_block`. Test: Jest su `user/blocks.ts`, Playwright in `block.spec.ts` (regole via API, blocco dal dettaglio spesa e sblocco dal Profilo, uscita dal gruppo). Come da piano; in piu':

- una spesa gia' in comune si modifica ancora: si controlla solo chi *entra* nella spesa;
- il menu "Blocca" spiega le conseguenze prima di confermare.


**Blocca** (tabella `UserBlock`, unica per coppia `bloccante → bloccato`). Se io blocco Marco:
- Marco non mi trova più con la ricerca e non mi vede fra i contatti;
- Marco non può aggiungermi a nuove spese, né aggiungermi modificando una spesa;
- non ricevo più notifiche delle sue azioni;
- non cambia niente nelle spese già esistenti e nei gruppi in comune: i saldi sono debiti veri. Da un gruppo con lui esco io;
- Marco non viene avvisato. Se prova ad aggiungermi riceve lo stesso errore di un utente inesistente.

API: `GET /api/user/blocks`, `POST /api/user/blocks` `{ publicId }`, `DELETE /api/user/blocks/:publicId`. UI: "Blocca" sulla riga di un partecipante nel dettaglio spesa, e l'elenco dei bloccati, con "Sblocca", nel Profilo.

**Esci dal gruppo:** un pulsante esplicito nelle impostazioni del gruppo, con conferma. L'API c'è già: è la rimozione di sé stessi.

### Fase D: registrazione aperta (fatta, 2026-11-07, dal branch `registration`)

La fase D e' stata scritta due volte lo stesso giorno: una su `dev`, insieme alle fasi A-C, e una in un'altra sessione nel branch `registration`. Si e' tenuta la seconda, piu' completa, e la prima e' stata tolta prima del merge (merge di `registration` in `dev`, 2026-11-07). Rispetto al progetto qui sotto, la versione di `registration`:

- la apre l'interruttore **`AUTH_SIGN_UP=open`**, chiuso di default (va impostato su Render per aprirla davvero);
- ha anche il login con **Google** e **Apple** (solo ID token, niente redirect OAuth) e collega gli account con la stessa email verificata;
- usa come nickname proposto il nome di Google/Apple ripulito, oppure `user` + 8 cifre;
- limita la ricerca utenti a 30 ricerche **all'ora** per utente;
- ha `/welcome` con un campo nickname condiviso con il Profilo (`NicknameField`), e manda li' chi ha `needsName` dall'`authGuard`.

Dal lavoro su `dev` sono rimasti: il rimando a `/welcome` della pagina `/join` (che non ha `authGuard`), il controllo `/\host` in `safeReturnUrl`, il messaggio "Troppe ricerche" e i test: e2e "registrazione dal link d'invito" (`invite.spec.ts`) e "il nome mandato al primo login" (`registration.spec.ts`), Jest su `safeReturnUrl` e `nicknameFromName`. Dettagli in CLAUDE.md, **Registration**, e in [Auth.md](Auth.md). Il login con Apple non e' ancora stato provato.

## Il link

### Modello

```prisma
model GroupInvite {
  id          Int       @id @default(autoincrement())
  groupId     Int
  tokenHash   String    @unique   // SHA-256 del token, mai il token in chiaro
  createdById Int
  createdDate DateTime  @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?
}
```

Più `UserOnGroup.inviteId Int?`: un audit minimo di chi è entrato con quale link.

- **Token:** 32 byte casuali (`crypto.randomBytes`) in base64url, 43 caratteri. Nel DB si salva solo lo SHA-256, come per i codici OTP, quindi chi legge il DB non ottiene link validi. Basta un hash veloce (non bcrypt), perché il token ha 256 bit di entropia.
- **Un solo link attivo per gruppo.** "Nuovo link" revoca il precedente. Le righe vecchie restano per l'audit.
- **Scadenza:** un link scaduto blocca solo i nuovi ingressi: chi è già entrato resta membro.

### API

| Rotta | Auth | Cosa fa |
|---|---|---|
| `POST /api/group/:publicId/invite` `{ expiresInDays }` | sessione + membro | Crea il link, revoca il precedente e restituisce il token **una sola volta** |
| `DELETE /api/group/:publicId/invite` | sessione + membro | Revoca il link attivo |
| `POST /api/invite/preview` `{ token }` | **pubblica** | Nome del gruppo, nickname di chi invita, numero di membri, scadenza. Niente nomi dei membri né spese |
| `POST /api/invite/join` `{ token }` | sessione | Rende membro chi chiama (idempotente), avvisa i membri e restituisce il `publicId` del gruppo |

- Errori con un `code` che il frontend traduce: `INVITE_NOT_FOUND` (404), `INVITE_EXPIRED` e `INVITE_REVOKED` (410).
- Il **gruppo si ricava sempre dal token**, mai da un parametro del client. È anche il confine che userà l'accesso ospite.

### Dove sta il token

Il link è `https://<app>/join#<token>`: il token sta nel **fragment**, non nel path.

- **Path** (`/join/<token>`): il token fa parte della richiesta HTTP della pagina, quindi finisce nei log di accesso dell'hosting del frontend e degli eventuali proxy, e nell'header `Referer` se la pagina carica risorse esterne.
- **Fragment** (`/join#<token>`): il browser non manda mai la parte dopo `#` al server. Niente log, niente Referer. La legge solo il codice della pagina (`ActivatedRoute.fragment`). I deep link di Capacitor e la PWA non cambiano, perché si basano sul path `/join`.

Per lo stesso motivo le chiamate all'API passano il token nel **body**, mai nell'URL.

**Attraverso il login** il token non deve finire nel `returnUrl`, che un ricaricamento della pagina manderebbe all'hosting. Quindi:

1. la pagina `/join` legge il fragment, lo salva in `sessionStorage` e lo toglie dalla barra degli indirizzi (`history.replaceState`);
2. manda al login con `returnUrl=/join`, senza token;
3. dopo il login torna a `/join`, che riprende il token da `sessionStorage`.

Se il link si riapre in una scheda nuova, il fragment c'è di nuovo, quindi non si perde niente.

### Pagina `/join`

Fuori dalla shell a tab e senza `authGuard`. Mostra l'anteprima ("Pippo ti invita in **Lisbona** · 5 membri") e poi:

- **con sessione**: "Unisciti" → `join` → `navigateRoot('/tabs/groups/<publicId>')`;
- **già membro**: va direttamente al gruppo;
- **senza sessione**: "Accedi per entrare" → login;
- **link scaduto, revocato o inesistente**: un messaggio che dice di chiederne uno nuovo a chi l'ha mandato.

**Mai un ingresso automatico all'apertura della pagina.** Le app di chat aprono i link per generare l'anteprima: entrare senza un tocco esplicito farebbe entrare chiunque abbia la sessione su quel dispositivo.

Nelle impostazioni del gruppo, la condivisione usa la Web Share API (o il plugin Share di Capacitor nell'app nativa), oppure "Copia link". Il token si vede solo alla creazione: per ricondividerlo dopo serve un link nuovo.

### Sicurezza

- **Il link è una credenziale:** chiunque lo abbia entra nel gruppo e ne vede tutte le spese. Lo proteggono la scadenza, la revoca, la notifica a tutti i membri quando qualcuno entra, la rimozione di un membro (che esiste già) e l'audit `UserOnGroup.inviteId`.
- **Forza bruta:** con 256 bit è impraticabile anche senza un rate limit Nest (oggi non c'è).
- **Permessi:** per ora qualsiasi membro crea e revoca link, come per il resto del gruppo. Quando arriva l'owner (TODO in `group.service.ts`), lo si valuterà anche per i link.

## Registrazione aperta

### Flusso

La pagina di login **non cambia**: email → codice. Se l'email non ha un account, il primo codice valido lo crea.

```
Login: [email] → [codice]
   ├─ utente esistente → returnUrl (default /tabs/activity)
   └─ utente nuovo     → /welcome "Come ti chiami?" → returnUrl
```

### Backend

- `emailOTP({ disableSignUp: false })` in `auth.factory.ts`.
- Better Auth crea l'utente con il `name` passato a `sign-in/email-otp`, altrimenti `""`. `User.nickName` è `citext @unique`, quindi il secondo utente con nome vuoto farebbe fallire l'insert. In `databaseHooks.user.create.before`:
  - si assegna un **nome provvisorio unico** e valido per `nickname.ts`, per esempio `user` + 8 cifre casuali;
  - si imposta **`User.needsName = true`** (nuova colonna, default `false`).
  - Il nome non si chiede prima del codice: la UI dovrebbe chiederlo a tutti, oppure rivelare chi è registrato.
- `PATCH /api/user/me` rimette `needsName = false`. Regole e codici d'errore (`NICKNAME_*`) restano quelli di oggi.
- `needsName` arriva al frontend tramite gli `additionalFields` di Better Auth e la risposta di `PATCH /api/user/me`.
- Un'email registrata e una sconosciuta ricevono **la stessa risposta** a `send-verification-otp`, e ora tutte e due ricevono il codice.
- Rate limit su `GET /api/user`. Nest non ha ancora un throttler.

### Frontend

- Pagina **`/welcome`**: un campo nome, con lo stesso controllo dal vivo di `EditNicknameModal`, e "Continua".
- Una guard sulle rotte autenticate: se `currentUser.needsName` è vero, rimanda a `/welcome` **conservando il `returnUrl`**, che serve per tornare al link d'invito.
- Va riscritto `login.code-sent` ("Se {{email}} ha un account…"): ora il codice arriva sempre.

### Rischi

- **Chiunque può far mandare email dal server.** Brevo gratuito permette circa 300 email al giorno, e il rate limit è di 3 invii al minuto per IP. Esaurita la quota, nessuno riceve più il codice fino al giorno dopo. Il captcha (plugin `captcha` di Better Auth) è da riconsiderare se arrivano abusi.
- **Spese da sconosciuti:** chiunque si iscrive può trovare un utente con la ricerca esatta e aggiungerlo a una spesa. La difesa è "Blocca" (fase C), che quindi va fatta prima della fase D.
- **Prima di un'apertura vera** servono l'**eliminazione dell'account** e un'**informativa privacy** (GDPR).
- Documenti da aggiornare: [Auth.md](Auth.md) ("Registrazione disabilitata"), [DECISIONI_HOSTING.md](DECISIONI_HOSTING.md) ("non serve la registrazione"), CLAUDE.md (Auth, User search).

## Estensione futura: ospiti senza account

Solo design, nessuna fase. Serve a verificare che le fasi A-D non chiudano strade.

- Chi non fa login potrà aggiungere spese **solo a quel gruppo**, solo pagate da sé, e vedere spese e saldi del gruppo. Non potrà modificare né cancellare niente. Al primo accesso sceglierà "Chi sei?" fra i membri senza account, oppure un nome nuovo. Quando si registra, reclama quel nome e tiene le sue spese.
- **Vincoli già rispettati:** il gruppo si ricava dal token; nessun ingresso automatico; l'anteprima pubblica non mostra dati sensibili; `/join` ha il posto per "Continua come ospite"; lista spese e saldi prendono il punto di vista in input.
- **Membro senza account = una riga `User`** con `isGuest = true` e un'email sintetica non recapitabile (`guest-<uuid>@guest.invalid`, dominio riservato dall'RFC 2606): `email` resta obbligatoria e nessuno può fare login con quell'indirizzo. Escluso dalla ricerca e dai contatti, appartiene a un solo gruppo.
- **`GuestAccess`:** token ospite hashato, legato a invito, gruppo e membro. Dura 30 giorni, rinnovati a ogni uso; muore con la revoca del link o con la rimozione del membro.
- **`GuestAuthGuard`** su un insieme chiuso di rotte `/api/guest/*`: lettura del gruppo, delle sue spese e delle categorie preset; creazione di una spesa con `paidBy = createdBy = ospite` e il gruppo imposto dal server, tramite `buildCreateData`. **Niente PATCH né DELETE**: il limite è garantito dall'assenza delle rotte. Il token passa in un header dedicato, così un suo 401 non attiva il logout dell'`authInterceptor`.
- **Reclamo:** `POST /api/guest/claim` (sessione + token ospite) sposta quote, `createdBy`, `paidBy` e membership sull'utente registrato in una `$transaction`, poi cancella l'ospite. Se l'utente era già nella stessa spesa, le due quote si sommano. Le notifiche dell'ospite si cancellano.
- **Perché non il plugin `anonymous` di Better Auth:** darebbe all'ospite una sessione valida su tutta l'API, `/sign-in/anonymous` è aperto a chiunque, e il passaggio dei dati (`onLinkAccount`) non sta nella stessa transazione della cancellazione dell'anonimo.
- **Ostacolo principale, il nickname unico:** l'ospite "Marco" collide con un "Marco" registrato altrove, e le regole di oggi rifiutano "Ugo" e "Nicolò". Prima degli ospiti il nickname deve diventare un nome visualizzato non unico, il che vuol dire togliere la ricerca per nickname e tenere solo quella per email.
- **Rischi da accettare allora:** chi ha il link può fingersi un altro membro senza account (Tricount funziona così) e creare spese "pagate da me". Mitigazioni: scadenza e revoca del link, rimozione del membro, spese marcate "aggiunta da Marco (ospite)".
