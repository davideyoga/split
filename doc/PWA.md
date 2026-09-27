# Split come PWA

Data: 2026-09-27. Stato: **implementato**, da pubblicare su Render (static site).

`splitFront` è installabile come Progressive Web App: dal browser del telefono si aggiunge alla schermata Home e si apre a schermo intero, senza barra degli indirizzi. È la strada scelta per l'alpha al posto dell'app nativa Capacitor, che richiederebbe gli store o l'installazione manuale dell'APK.

## Cosa c'è

| Pezzo | Dove | Note |
|---|---|---|
| Service worker | `@angular/service-worker` (MIT), `provideServiceWorker` in `splitFront/src/main.ts` | Acceso solo se `!isDevMode()`. `ngsw-worker.js` viene generato solo dalla build `production`, perché solo quella configurazione ha `"serviceWorker": "splitFront/ngsw-config.json"` in `project.json`. In `development` ed `e2e` resta spento. |
| Cache | `splitFront/ngsw-config.json` | Gruppo `app` in `prefetch`: `index.html`, JS, CSS, manifest, favicon e i due file di traduzione. Gruppo `assets` in `lazy`: icone e `/svg/**`. |
| Manifest | `splitFront/src/public/manifest.webmanifest` | `display: standalone`, `start_url: /`, sfondo e tema bianchi. |
| Icone | `splitFront/src/public/icons/`, `splitFront/src/public/favicon.png` | Generate da `splitFront/icon/icon.svg`, vedi sotto. |
| Meta iOS e tema | `splitFront/src/index.html` | `apple-touch-icon`, `apple-mobile-web-app-title`, `theme-color` chiaro `#ffffff` e scuro `#1f1f1f` (il colore della toolbar Ionic `md` in tema scuro). |
| Avviso di nuova versione | `splitFront/src/app/services/app-update.service.ts`, avviato da `AppComponent` | Toast "Nuova versione disponibile" con i pulsanti Ricarica e Più tardi (`update.*` in `en.json`/`it.json`). |

**Bug corretto insieme alla PWA:** la cartella `splitFront/src/public/` non era negli `assets` di `project.json`. Il favicon quindi non finiva nella build e in produzione rispondeva 404. Ora la cartella viene copiata nella radice del sito.

## Decisioni

- **I dati non vanno in cache: servono online.** Il service worker non intercetta l'API. Il backend sta su un'altra origin (`split-eued.onrender.com`) e nel config non c'è nessun `dataGroups`. Un'app di spese condivise che mostra saldi vecchi come se fossero attuali fa più danni di una che dice "sei offline". Offline si apre solo la struttura dell'app, e le chiamate falliscono come nel browser. **Scorciatoia alpha:** una modalità offline vera (lettura dalla cache e spese in coda) è da valutare dopo la beta.
- **Aggiornamenti: si propone di ricaricare, non si ricarica da soli.** Con il service worker l'app parte dalla cache. Dopo un deploy la nuova versione viene scaricata in background, e senza ricaricamento l'utente resta sulla vecchia fino alla riapertura successiva. Ricaricare in automatico farebbe perdere, per esempio, una spesa in compilazione. Per questo compare un toast. I pulsanti del toast hanno solo un `role`, letto con `onDidDismiss()`: vale la stessa regola degli alert, perché gli `handler` girano fuori dalla zona di Angular (vedi CLAUDE.md).
- **Controllo aggiornamenti al ritorno in primo piano.** Il service worker di Angular cerca una nuova versione solo quando l'app viene aperta da zero. Un'app installata resta spesso in background per giorni, quindi `AppUpdateService` chiama `checkForUpdate()` anche a ogni `visibilitychange` verso `visible`.
- **`registerWhenStable:30000`**, il default di Angular: il service worker si registra quando l'app è stabile, o dopo 30 secondi al massimo, per non rallentare il primo avvio.
- **Una sola icona sorgente** per favicon, icone del manifest, maskable e apple-touch.

## Icone

L'unica sorgente è `splitFront/icon/icon.svg`. Le icone si rigenerano con:

```
node splitFront/scripts/generate-icons.mts [sorgente]
```

Lo script usa il Chromium già installato per Playwright, quindi non servono dipendenze di grafica. Accetta anche un PNG o JPG quadrato di almeno 1024×1024. Scrive `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png` (180) e `favicon.png` (64) in `splitFront/src/public/`.

Requisiti della sorgente, perché la stessa immagine vada bene per tutte le icone:

- **quadrata, con lo sfondo pieno fino ai bordi e senza trasparenza.** iOS riempie di nero le parti trasparenti dell'`apple-touch-icon`;
- **senza angoli arrotondati:** la forma la applica il sistema (cerchio, squircle, ecc.);
- **disegno entro il cerchio centrale di raggio 40% del lato.** È la "zona sicura" delle icone `maskable`: Android può ritagliare tutto quello che sta fuori.

## Installazione (istruzioni per i tester)

- **Android (Chrome):** aprire il sito, poi scegliere "Installa app" nel banner o nel menu ⋮. L'app compare nel cassetto delle app.
- **iPhone (Safari):** Condividi → "Aggiungi alla schermata Home". Da altri browser iOS l'opzione può mancare. **Al primo avvio bisogna rifare il login:** su iOS l'app installata ha una memoria separata da Safari, e il token salvato in `localStorage` (`split_auth`) non viene condiviso. Su Android la memoria è quella di Chrome e la sessione resta.

Login, CORS e `AUTH_TRUSTED_ORIGINS` non cambiano: la PWA gira sulla stessa origin del sito.

## Hosting (Render static site)

- **Nessuna configurazione in più su Render.** Il rewrite `/*` → `/index.html` interviene solo sui percorsi che non esistono, quindi `ngsw-worker.js`, `ngsw.json` e `manifest.webmanifest` vengono serviti per quello che sono.
- Render manda i file con `cache-control: public, max-age=0, s-maxage=300`, quindi il CDN li tiene al massimo 5 minuti. `ngsw.json` viene chiesto con un parametro `ngsw-cache-bust` che salta la cache. Nel caso peggiore, un deploy viene visto dal service worker con 5 minuti di ritardo.
- **Se un deploy rompe il service worker** (per esempio gli utenti restano bloccati su una versione rotta), la via d'uscita di Angular è pubblicare `safety-worker.js` al posto di `ngsw-worker.js`. È incluso nella build: si copia `dist/splitFront/browser/safety-worker.js` sopra `ngsw-worker.js` e si pubblica. Il safety worker si disinstalla da solo e svuota le cache.

## Verifica fatta (2026-09-27)

Controllato con Playwright su una build `production` servita in locale (`python3 -m http.server`):

- il service worker viene registrato, si attiva e controlla la pagina;
- manifest, icone, apple-touch-icon e favicon rispondono 200;
- nuovo deploy simulato (un file aggiunto a `dist`, poi `ngsw.json` rigenerato con `node_modules/.bin/ngsw-config dist/splitFront/browser splitFront/ngsw-config.json`) → al `visibilitychange` compare il toast. "Ricarica" porta la pagina sulla nuova versione (verificato su `/ngsw/state`).

Per ripetere la prova basta ricostruire (`npx nx build splitFront`) e servire `dist/splitFront/browser` su `localhost`: il service worker richiede HTTPS, ma `localhost` è ammesso. `nx serve` non basta, perché usa la configurazione `development`.

## Possibili passi successivi

- Pulsante "Installa l'app" nel Profilo, con `beforeinstallprompt` su Android e istruzioni su iOS.
- Notifiche push, per esempio "Pippo ha aggiunto una spesa". Su iOS funzionano solo con l'app installata (iOS 16.4+). Servono un backend con Web Push (chiavi VAPID) e il consenso dell'utente.
- Colori del tema Ionic allineati al logo (teal `#0F5E56`). Oggi il manifest usa il bianco della toolbar.
