# Decisioni hosting e messa online (alpha)

Data: 2026-09-26. Stato: **proposta, da confermare**. La scelta dell'hosting non è ancora fatta, e nessuno degli interventi elencati sotto è ancora stato implementato.

Prezzi e limiti dei piani sono stati verificati il 2026-09-26. I piani gratuiti e i listini cambiano spesso: vanno ricontrollati prima di attivare qualcosa.

## Contesto

L'app è quasi pronta per un'alpha con un gruppo ristretto di tester scelti. Per l'alpha:

- serve un login con **password**: oggi il login è solo email (vedi CLAUDE.md, sezione "Auth");
- **non serve la registrazione**: gli utenti vengono creati a mano sul DB del server remoto;
- l'app va esposta su internet, possibilmente gratis o con pochi euro al mese.

## 1. Cosa serve oltre alla password

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

### Opzione gratuita valutata: Neon + Render

- **Neon** per Postgres (piano gratuito): 0,5 GB di spazio e 100 ore di calcolo al mese. Il DB si spegne da solo dopo 5 minuti senza query e non scade. Ci si collega dal PC di sviluppo con la connection string, sia per Prisma Studio sia per lo script `create-user`.
- **Render** per il backend Nest (web service gratuito) e per il frontend (static site gratuito). Non serve la carta di credito.
- **Il Postgres gratuito di Render va evitato**: scade dopo 30 giorni, e 14 giorni dopo viene cancellato con tutti i dati.
- **Limite principale:** il backend gratuito di Render si spegne dopo 15 minuti senza richieste e ci mette circa un minuto a ripartire. Per un tester che apre l'app al ristorante è il problema più visibile.
  - Si aggira con un ping gratuito ogni 10 minuti (cron-job.org o UptimeRobot). Le 750 ore gratuite al mese coprono un servizio sempre acceso.
  - Il ping deve chiamare `GET /api`, che non interroga il DB. Altrimenti tiene sveglio anche Neon e ne consuma le ore di calcolo.
- **Rewrite sullo static site:** serve una regola `/*` → `/index.html`, altrimenti ricaricando la pagina su una rotta Angular (es. `/tabs/activity`) si ottiene un 404.

Lo spegnimento automatico di Render è stato giudicato poco accettabile, per questo sono state valutate le alternative a pagamento qui sotto.

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

### Raccomandazione: Render Starter + Neon

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

- [ ] Confermare Render Starter + Neon, oppure scegliere un'altra opzione.
- [ ] Implementare i bloccanti della sezione 1. Ordine proposto: (1) password, script `create-user` e pagina di login; (2) chiusura degli endpoint utente, throttler e CORS; (3) `fileReplacements`, divisione del seed e prova delle migrazioni su DB vuoto.
- [ ] Registrare in CLAUDE.md le scorciatoie dell'alpha una volta implementate.

## Fonti

- [Render: Platforms with a real free tier in 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [Render Free Tier 2026: 750 Hours](https://unanswered.io/guide/render-free-tier-details)
- [Render Pricing 2026 (srvrlss.io)](https://www.srvrlss.io/provider/render/)
- [Render: hosting costs for small businesses](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses)
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
