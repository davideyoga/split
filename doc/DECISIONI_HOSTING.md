# Decisioni hosting e messa online (alpha)

Data: 2026-09-26, aggiornato il 2026-09-27. Stato: **hosting deciso** (Render gratuito + Neon gratuito + ping, vedi sezione 2). Nessuno degli interventi elencati sotto è ancora stato implementato.

Prezzi e limiti dei piani sono stati verificati il 2026-09-26. I piani gratuiti e i listini cambiano spesso: vanno ricontrollati prima di attivare qualcosa.

## Contesto

L'app è quasi pronta per un'alpha con un gruppo ristretto di tester scelti. Per l'alpha:

- serve un login con **password**: oggi il login è solo email (vedi CLAUDE.md, sezione "Auth");
- **non serve la registrazione**: gli utenti vengono creati a mano sul DB del server remoto;
- l'app va esposta su internet, possibilmente gratis o con pochi euro al mese.

## 1. Cosa serve oltre alla password

> **Nota del 2026-09-27:** il login con password descritto nel punto 1 è stato superato dalla decisione di usare Better Auth con codice via email (OTP), con la registrazione disattivata per l'alpha. Il resto dei bloccanti resta valido.

### Bloccanti

1. **Login con password.**
   - `User` non ha un campo password: servono una colonna `passwordHash` con la sua migrazione e l'hash fatto con `bcrypt` o `argon2`, mai la password in chiaro.
   - `LoginDto` deve ricevere anche `password`. Il login deve restituire un unico errore "credenziali non valide", sia per email sconosciuta sia per password sbagliata ([auth.service.ts:23](../splitBack/src/app/auth/auth.service.ts#L23)).
   - Frontend: nella pagina di login va aggiunto il campo password, e l'errore va cambiato. Oggi ogni errore mostra "No account found for this email" (`login.user-not-found`). Le chiavi i18n vanno in `en.json` e `it.json`.
   - **Creazione degli utenti a mano:** un hash non si scrive a mano in SQL. Serve uno script sul modello di `seed.ts`, tipo `create-user <email> <nick> <password>`, da lanciare dal PC di sviluppo con il `DATABASE_URL` del server. Lo script sostituisce il "entro nel DB e creo i record".
2. **`POST /api/user` è pubblico** ([user.controller.ts:17](../splitBack/src/app/user/user.controller.ts#L17)). Chiunque trovi l'URL può crearsi un account. Visto che la registrazione non serve, l'endpoint va tolto.
3. **La ricerca utenti è pubblica** ([user.controller.ts:22](../splitBack/src/app/user/user.controller.ts#L22)). `GET /api/user/:nickname` non richiede login e restituisce nickname e publicId di tutti gli utenti. Va protetta con `JwtAuthGuard`.
4. **La build di produzione del frontend chiama localhost.**
   - In [project.json](../splitFront/project.json#L47) la configurazione `production` non ha `fileReplacements`. Quindi [environment.prod.ts](../splitFront/src/environments/environment.prod.ts) non viene mai usato, e l'app pubblicata chiamerebbe `http://localhost:3000/api`.
   - L'URL in `environment.prod.ts` (`api.nonlosoancora.com`) è un segnaposto da sostituire con quello reale.
5. **Categorie preset sul DB di produzione.** Le 10 categorie preset esistono solo in `splitBack/prisma/seed.ts`, insieme agli utenti di test Disney, che hanno email note. Il seed va diviso: le categorie vanno caricate in produzione, gli utenti di test no.

### Consigliati (interventi piccoli)

- **HTTPS**: indispensabile con le password. Con Render (vedi sotto) è incluso.
- **CORS ristretto** all'URL del frontend invece di `enableCors()` aperto ([main.ts:19](../splitBack/src/main.ts#L19), già in `TODO.md`). Se i tester usano anche l'app Capacitor, vanno aggiunte le sue origin: `https://localhost` (Android) e `capacitor://localhost` (iOS).
- **Limite di tentativi sul login** con `@nestjs/throttler`. Senza, chiunque può provare password all'infinito.
- **Password del DB e `JWT_SECRET` nuovi per la produzione**, diversi da quelli di sviluppo e impostati nel pannello dell'hosting, non in un file `.env`.
- **Il server non deve partire se manca la configurazione.** Oggi con `JWT_SECRET` vuoto il server parte lo stesso e il login risponde 500. `PrismaService` inoltre ignora un DB irraggiungibile: logga l'errore e ogni richiesta fallisce con 500.
- **Provare le migrazioni su un DB vuoto.** In produzione si usa `prisma migrate deploy`, che applica tutta la cartella `splitBack/prisma/migrations` da zero. Alcune migrazioni sono state scritte a mano (vedi CLAUDE.md), quindi va verificato una volta prima del primo deploy.

### Scorciatoie accettate per l'alpha

Scorciatoie da rivedere prima della beta:

- **Niente "cambia password" o "password dimenticata".** La password la genera lo sviluppatore, la comunica al tester e la resetta con lo stesso script `create-user`.
- **Non si può togliere l'accesso a una sola persona.** Cambiarle la password non basta, perché il token JWT resta valido fino a 30 giorni. L'unica opzione è cambiare `JWT_SECRET`, che disconnette tutti gli utenti.

## 2. Hosting

### Decisione (2026-09-27): Neon + Render gratuiti, con ping

Per l'alpha si parte gratis. Se lo spegnimento di Render dà fastidio ai tester, si passa a Render Starter (vedi sotto): basta cambiare il tipo di istanza nel pannello, senza toccare il codice.

- **Neon** per Postgres (piano gratuito): 0,5 GB di spazio e 100 ore di calcolo al mese. Il DB si spegne da solo dopo 5 minuti senza query e non scade. Ci si collega dal PC di sviluppo con la connection string, sia per Prisma Studio sia per creare gli utenti.
- **Render** per il backend Nest (web service gratuito) e per il frontend (static site gratuito). Non serve la carta di credito.
- **Il Postgres gratuito di Render va evitato**: scade dopo 30 giorni, e 14 giorni dopo viene cancellato con tutti i dati.
- **Rewrite sullo static site:** serve una regola `/*` → `/index.html`, altrimenti ricaricando la pagina su una rotta Angular (es. `/tabs/activity`) si ottiene un 404.

#### Configurazione del backend su Render (2026-09-27)

Web Service, runtime Node, regione Frankfurt, istanza Free, branch `test`, Root Directory vuota (il monorepo si builda dalla root).

- **Build Command:** `npm ci --include=dev && npx prisma generate --schema=splitBack/prisma/schema.prisma && npx prisma migrate deploy --schema=splitBack/prisma/schema.prisma && npx nx build splitBack`
  - `--include=dev`: Nx, webpack e la CLI di Prisma sono devDependencies, e `npm ci` le salterebbe se `NODE_ENV=production` fosse impostato.
  - `prisma generate` va lanciato a mano: lo schema non è in una posizione standard, quindi il postinstall di `@prisma/client` non lo trova.
  - `migrate deploy` sta nella build e non nello start: se una migrazione fallisce, fallisce il deploy e resta online la versione precedente. Il Pre-Deploy Command di Render non è disponibile sul piano gratuito.
- **Start Command:** `node splitBack/dist/main.js` (il bundle richiede i `node_modules` della root).
- **Variabili d'ambiente:**

  | Variabile | Valore |
  |---|---|
  | `NODE_VERSION` | `22.21.1`: Better Auth è solo ESM e il backend è CommonJS, serve Node ≥ 22.12 |
  | `NX_NO_CLOUD` | `true`: `nx.json` ha un `nxCloudId`, e la build non deve provare a collegarsi a Nx Cloud |
  | `DATABASE_URL` | connection string **diretta** di Neon + `&connect_timeout=15` |
  | `BETTER_AUTH_SECRET` | nuovo, diverso da quello di sviluppo |
  | `BETTER_AUTH_URL` | `https://<servizio>.onrender.com` |
  | `MAIL_TRANSPORT` | `brevo` (con `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME`), oppure `console` per una prima prova: il codice compare nei log di Render |
  | `AUTH_TRUSTED_ORIGINS` | l'URL dello static site del frontend, più `https://localhost,capacitor://localhost` se si usa l'app Capacitor. Impostarla **sostituisce** i default |

  `PORT` lo imposta Render. `NODE_ENV` non va impostato.
- **Verifica:** `https://<servizio>.onrender.com/api` risponde `{"message":"Hello API"}`.
- **Migrazioni su DB vuoto:** verificate il 2026-09-27. Le 7 migrazioni si applicano su un DB vuoto e il risultato coincide con `schema.prisma` (`migrate diff --exit-code` = 0).
- **Limite noto:** dietro il proxy di Render, `req.socket.remoteAddress` è l'IP del proxy, quindi il rate limit sull'invio dei codici (3 al minuto per IP) è condiviso da tutti i tester. Vedi il TODO in [auth.factory.ts](../splitBack/src/app/auth/auth.factory.ts#L13).

Backend pubblicato il 2026-09-27: `https://split-eued.onrender.com/api`. La radice `/` risponde 404 perché tutte le rotte stanno sotto `/api`.

#### Configurazione del frontend su Render (static site)

- **Build Command:** `npm ci --include=dev && npx nx build splitFront` (configurazione `production` di default).
- **Publish Directory:** `dist/splitFront/browser`.
- **Variabili d'ambiente:** `NODE_VERSION` = `22.21.1`, `NX_NO_CLOUD` = `true`.
- **Redirects/Rewrites:** Source `/*`, Destination `/index.html`, Action **Rewrite**.
- Branch `test`. Gli static site non si spengono e non consumano le 750 ore dei web service.
- Pubblicato il 2026-09-27: `https://split-app-n4lk.onrender.com`. Il rewrite è verificato: `/tabs/activity` e `/login` caricati direttamente rispondono 200.
- **Dopo la creazione**, sul backend: `AUTH_TRUSTED_ORIGINS` = `https://split-app-n4lk.onrender.com,https://localhost,capacitor://localhost`. Senza, la richiesta del codice risponde `403 INVALID_ORIGIN` (verificato).
- L'URL dell'API è scritto in [environment.prod.ts](../splitFront/src/environments/environment.prod.ts), che la configurazione `production` usa al posto di `environment.ts` con `fileReplacements` (aggiunti il 2026-09-27). Se cambia l'URL del backend, va cambiato lì.
- **Budget del bundle alzato** (2026-09-27): la prima build `production` falliva, perché il bundle iniziale pesava 1,15 MB con un limite di errore di 1 MB. I limiti sono diventati avviso a 1 MB ed errore a 2 MB. Compresso, il bundle trasferito pesa circa 230 kB. Ridurlo, per esempio togliendo import non usati, è un'ottimizzazione rimandata.

#### Il ping (keep-alive)

**Il problema:** il backend gratuito di Render si spegne dopo 15 minuti senza traffico in arrivo e ci mette circa un minuto a ripartire. Per un tester che apre l'app a fine cena è il difetto più visibile.

**La soluzione:** un servizio esterno gratuito (cron-job.org o UptimeRobot) chiama `GET https://<servizio>.onrender.com/api` ogni 10 minuti. Render vede traffico, il timer dei 15 minuti non scade e il server resta acceso. Non richiede codice: `GET /api` esiste già e risponde `{ message: 'Hello API' }` ([app.service.ts](../splitBack/src/app/app.service.ts)).

**Regole:**

- **Il ping deve chiamare `GET /api`, che non tocca il DB.** Se interrogasse il DB ogni 10 minuti, Neon resterebbe acceso almeno 5 minuti su 10: circa 360 ore al mese contro le 100 del piano gratuito, e il DB verrebbe sospeso a metà mese. Le connessioni che Prisma tiene aperte senza fare query invece non tengono sveglio Neon, che conta solo query e nuove connessioni.
- **Un solo web service gratuito sempre acceso.** Le 750 ore gratuite al mese sono per workspace, condivise tra tutti i servizi gratuiti; un mese ne ha al massimo 744. Un secondo servizio sempre acceso (es. uno staging) le esaurisce a metà mese, e Render sospende **tutti** i servizi gratuiti fino al mese dopo. Lo static site non consuma queste ore.

**Limiti accettati per l'alpha:**

- **Il ping riduce gli avvii lenti, non li elimina.** Render può riavviare un servizio gratuito in qualsiasi momento, quindi ogni tanto un tester aspetterà comunque il minuto di avvio.
- **È una pratica tollerata, non garantita.** La documentazione del piano gratuito di Render non parla dei ping né per vietarli né per permetterli. Se Render li bloccasse non si rompe niente: si torna agli avvii lenti, o si passa a Starter.
- **Da provare prima dell'alpha: Prisma dopo la pausa di Neon.** Con il ping il server resta acceso per giorni, mentre Neon si spegne dopo 5 minuti e chiude le connessioni aperte. Prisma di solito si riconnette da solo, ma la prima query dopo la pausa può fallire. Prova: lasciare il DB fermo più di 5 minuti, poi aprire l'app e controllare che la prima schermata carichi.
- **Da controllare la prima settimana: il consumo di Neon.** Su un piano a pagamento è stato segnalato che i controlli periodici di Neon consumano calcolo anche senza traffico. Non è chiaro se succeda sul piano gratuito: va guardato il consumo nel pannello di Neon.

### Scartata: Oracle Cloud "Always Free"

È la VM gratuita più consigliata in giro, ma è stata scartata:

- a giugno 2026 Oracle ha dimezzato i limiti delle VM Ampere A1 senza avvisare, spegnendo istanze esistenti;
- le VM poco usate vengono recuperate da Oracle (uso sotto il 20% per 7 giorni);
- server, Postgres, HTTPS, aggiornamenti e backup andrebbero gestiti a mano.

### Alternative a pochi euro al mese

| | Costo | Si spegne? | Lavoro di gestione |
|---|---|---|---|
| **Render Starter** | 7 $/mese (circa 6 €) | No | Nessuno: cambia solo il tipo di istanza |
| Railway Hobby | 5 $/mese, con 5 $ di consumo inclusi | No | Nessuno, ma è a consumo e il costo può crescere |
| Hetzner VPS (CX23: 2 CPU, 4 GB, Germania o Finlandia) | circa 4,35 €/mese + IVA | No | Il server è tutto da gestire |

### Se il piano gratuito non basta: Render Starter + Neon

Era la raccomandazione del 2026-09-26. Ora è il passo successivo, se lo spegnimento di Render dà fastidio.

- Costo di circa 6 € al mese: Render Starter per il backend, frontend sullo static site gratuito di Render, Neon per il DB.
- Il piano di deploy resta quello dell'opzione gratuita, e il ping non serve più.
- I 512 MB di RAM di Render Starter bastano per Nest.
- Rispetto a Hetzner costa 1-2 € in più al mese. In cambio si hanno deploy a ogni push, HTTPS, log e riavvii automatici senza gestire un server.

**Quando avrebbe senso Hetzner:** se si vuole imparare a gestire un server o ospitarci altro. In quel caso la sicurezza della macchina è a carico nostro: firewall, SSH, aggiornamenti e HTTPS (con Caddy è quasi automatico).

- Per esempio, un Postgres in ascolto su `0.0.0.0` con utente superuser, come quello di sviluppo (vedi CLAUDE.md, "Environment setup"), su una VPS sarebbe esposto a tutta internet.
- Nel 2026 Hetzner ha alzato i prezzi due volte, ad aprile e a giugno, per la carenza di RAM.

## 3. Neon anche in produzione?

Per un'app come Split, sì: Neon può restare anche in produzione.

- **Nessun vincolo.** Neon è Postgres standard, un servizio maturo usato in produzione (dal 2025 fa parte di Databricks). Per cambiare fornitore bastano `pg_dump` e `pg_restore` verso qualsiasi altro Postgres, e nel codice cambia solo `DATABASE_URL`.
- **Modello di prezzo adatto.** Si paga il calcolo solo quando il DB lavora, e dopo 5 minuti senza query si spegne. Un'app che si apre ogni tanto (durante un viaggio, a fine cena) consuma poco. Probabilmente il piano gratuito basta anche per i primi utenti veri.
- **Con utenti veri si passa al piano Launch.** Non ha un minimo mensile e costa 0,106 $ per ora di calcolo per unità di capacità: la taglia più piccola costa quindi circa 2,7 centesimi l'ora di attività, più 0,35 $ per GB al mese. Il passaggio serve per affidabilità, non per potenza: sul piano gratuito, finite le 100 ore mensili, il DB viene sospeso fino al mese dopo, e in produzione vorrebbe dire app ferma.
- **Diventa caro solo con traffico continuo.** Un DB di media taglia sempre acceso costa circa 78 $ al mese; a quel punto conviene un Postgres a prezzo fisso. È un problema lontano.

Dettagli pratici:

- Il DB si risveglia in meno di un secondo, niente a che vedere con il minuto di Render gratuito. Con Prisma conviene aggiungere `connect_timeout=15` alla connection string, così la prima query dopo la pausa non va in timeout.
- Il DB va creato nella regione Francoforte, con il backend vicino. Ogni schermata fa più query, e con DB e server lontani ognuna aggiunge circa 100 ms.

## Da decidere

- [x] Scegliere l'hosting: Render gratuito + Neon gratuito + ping (2026-09-27).
- [x] Bloccanti 1–3 della sezione 1: login con codice via email (Better Auth), `POST /api/user` rimosso, ricerca utenti protetta (2026-09-27).
- [x] Migrazioni provate su un DB vuoto (2026-09-27).
- [x] Bloccante 4: `fileReplacements` nella configurazione `production` di `splitFront` e URL reale in `environment.prod.ts` (2026-09-27).
- [x] Utenti veri in produzione: `DATABASE_URL='<Neon>' node splitBack/prisma/add-users.mts`, che legge `splitBack/prisma/users.local.json` (gitignored, vedi CLAUDE.md "Seed test users") (2026-09-27). Il primo utente e le categorie sono stati creati con `seed.ts`.
- [ ] Bloccante 5: seed di produzione senza gli utenti Disney. Con `MAIL_TRANSPORT=brevo` non possono fare login (le email `@disney.test` non esistono), ma compaiono nella ricerca utenti. Ordine proposto: (1) password, script `create-user` e pagina di login; (2) chiusura degli endpoint utente, throttler e CORS; (3) `fileReplacements`, divisione del seed e prova delle migrazioni su DB vuoto.
- [ ] Registrare in CLAUDE.md le scorciatoie dell'alpha una volta implementate.

## Fonti

- [Render: Platforms with a real free tier in 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [Render Free Tier 2026: 750 Hours](https://unanswered.io/guide/render-free-tier-details)
- [Render Pricing 2026 (srvrlss.io)](https://www.srvrlss.io/provider/render/)
- [Render: hosting costs for small businesses](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses)
- [Render Docs: Deploy for Free](https://render.com/docs/free)
- [Neon: Using Scale to Zero with Long-Running Applications](https://neon.com/blog/using-neons-auto-suspend-with-long-running-applications)
- [Neon Docs: Scale to Zero](https://neon.com/docs/introduction/scale-to-zero)
- [neondatabase/neon, discussione #12900 (consumo senza traffico)](https://github.com/neondatabase/neon/discussions/12900)
- [Neon Pricing](https://neon.com/pricing)
- [Neon: Free plan limits and quotas](https://neon.com/faqs/free-plan-limits-and-quotas)
- [Neon Pricing: The Honest Cost of Serverless Postgres](https://selfhost.dev/blog/neon-pricing-cost-of-serverless-postgres/)
- [Neon Pricing Calculator (2026)](https://makerkit.dev/pricing-calculator/neon)
- [Railway Docs: Pricing Plans](https://docs.railway.com/pricing/plans)
- [Railway Pricing 2026 (DEV Community)](https://dev.to/nayankyada/railway-pricing-2026-free-tier-limits-usage-costs-when-to-upgrade-1acm)
- [Hetzner: Statement on price adjustment April 2026](https://www.hetzner.com/pressroom/statement-price-adjustment/)
- [Hetzner Docs: Price Adjustment 15 June 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [Northflank: Hetzner price increases in 2026](https://northflank.com/blog/hetzner-cloud-server-price-increases)
- [InfoQ: Oracle Quietly Halves Free Tier Ampere A1 Limits](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
- [Oracle: Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
