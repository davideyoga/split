# Playwright: test delle interfacce in autonomia

Sintesi della discussione del 2026-09-26 su come permettere a Claude Code di testare da solo la UI di `splitFront`, e di cosa è stato installato.

## Il problema

Claude Code non vede lo schermo. Per verificare un'interfaccia gli serve uno strumento che guidi un browser e gli restituisca qualcosa di leggibile:

- **snapshot di accessibilità**: la pagina come testo (ruoli, etichette, valori). È economico ed è il modo principale di navigare;
- **screenshot**: immagini PNG, utili per layout, sovrapposizioni e colori.

Ci sono due modi d'uso, complementari:

| Modo | Strumento | A cosa serve |
|---|---|---|
| Esplorativo | **Playwright MCP** | Claude usa l'app passo passo, come un tester manuale, mentre sviluppa una funzionalità. Non lascia nulla di ripetibile. |
| Test scritti | **Playwright Test** | Spec che girano da terminale a ogni modifica, e domani in CI: sono la rete contro le regressioni. |

## Alternative considerate

| Strumento | Perché no (per ora) |
|---|---|
| Chrome DevTools MCP | Ottimo per debug e prestazioni, ma solo Chrome e senza test ripetibili. Si può aggiungere accanto a Playwright. |
| Claude in Chrome (`claude --chrome`) | Usa il browser personale con i tuoi dati: poco isolato, niente CI. |
| Cypress | Pensato per un umano davanti al runner grafico; più lento e scomodo per un agente, e senza un MCP esplorativo. |
| Puppeteer | Solo Chrome e più di basso livello, senza vantaggi su Playwright. |
| Maestro / Appium | L'unica via per la build Capacitor nativa, ma richiedono emulatore e SDK. Da valutare solo se serviranno i plugin nativi. |
| Unit test Angular | Non girano in un browser vero. Si affiancano agli e2e, non li sostituiscono. |

Playwright vince perché copre entrambi i modi, entra nello shadow DOM dei componenti Ionic, emula i telefoni e produce trace e screenshot che Claude può leggere.

## Cosa è installato

- **devDependencies**: `@playwright/test` 1.63, `@nx/playwright` 22.1.0 (plugin Nx che deduce il target `e2e`), `@playwright/mcp` 0.0.82 (versione bloccata nel lockfile), `eslint-plugin-playwright`.
- **Browser**: Chromium di Playwright in `~/.cache/ms-playwright`. Su una macchina nuova, una volta: `npx playwright install chromium`.
- **`.mcp.json`** (root): server `playwright` con il Chrome di sistema ed emulazione Pixel 7. Alla prima apertura del repo Claude Code chiede di approvarlo; i tool compaiono dalla sessione successiva. Senza `--headless` la finestra del browser si vede mentre Claude la usa.
- **Progetto `splitFront-e2e/`**: 6 file di test (9 test) sui percorsi critici: login con codice via email (anche codice sbagliato, email sconosciuta e logout), spesa divisa in parti uguali (con dettaglio ed eliminazione), divisione non uniforme, gruppo con spesa di gruppo, rimborso dal tab Saldi.

## Come si usa

```
npx nx e2e splitFront-e2e                        # tutta la suite (~35 s, più le build la prima volta)
npx playwright test -c splitFront-e2e settle-up  # un solo file (filtro sul nome)
npx playwright test -c splitFront-e2e --headed   # vedere il browser
npx playwright show-report splitFront-e2e/test-output/playwright/report
```

Serve solo che Postgres sia acceso: API e frontend li avvia Playwright. Quando un test fallisce, in `splitFront-e2e/test-output/playwright/output/` restano screenshot, trace (`npx playwright show-trace …`) ed `error-context.md` con lo snapshot della pagina.

Per l'esplorazione con l'MCP, chiedi a Claude, per esempio: "apri localhost:4200, entra come pippo@disney.test e prova a saldare un debito". Attenzione: sullo stack di sviluppo (4200/3000) i dati creati finiscono in `split-db`.

## Come funziona lo stack e2e

- **Porte separate**: API sulla 3100, frontend sulla 4300 (configurazione `e2e` di `splitFront`, che sostituisce `environment.ts` con `environment.e2e.ts`). I test possono girare con `nx serve` acceso e non toccano mai l'API di sviluppo.
- **Database separato `split-db-e2e`**, ricreato da zero a ogni esecuzione da `splitFront-e2e/scripts/prepare-db.mts`: lo crea se manca, poi `migrate deploy`, `TRUNCATE` di tutte le tabelle e seed. Poi aggiunge gli utenti Disney dei test con `splitBack/prisma/add-users.mts` e `splitFront-e2e/scripts/users.e2e.json`. Dal 2026-09-27 questi utenti non stanno più in `seed.ts`, perché il seed gira anche in produzione. Lo script si rifiuta di partire se il nome del database non finisce con `-e2e`, e ricontrolla `current_database()` prima del `TRUNCATE`. L'URL è derivato da `DATABASE_URL`; si può forzare con `E2E_DATABASE_URL`.
- Il reset sta **nel comando del webServer dell'API**, non in un `globalSetup`, perché Playwright avvia i webServer *prima* del `globalSetup`: così il database è pronto prima che l'API si connetta.
- **Utenti per file**: ogni file di test usa utenti di test tutti suoi (`support/session.ts`; un utente nuovo va aggiunto anche a `scripts/users.e2e.json`), così i file girano in parallelo senza spostarsi i saldi a vicenda. Il login passa dall'API e scrive `split_auth` in localStorage; la UI di login ha il suo test.
- **Codici di login**: l'API dei test gira con `MAIL_TRANSPORT=outbox`, quindi invece di mandare le email scrive l'ultima di ogni destinatario in `dist/e2e-outbox/<email>.json`. `support/outbox.ts` legge il codice da lì (`readOtp`), e `apiLogin` fa le stesse chiamate dell'app: richiesta del codice, lettura, `sign-in/email-otp`. Il rate limit è spento (`AUTH_RATE_LIMIT=off`) perché tutti i login partono dallo stesso IP. Uno stesso utente non deve fare login da due file contemporaneamente: ogni richiesta di codice invalida la precedente.
- **Testi per chiave**: i test cercano gli elementi con `t('chiave.i18n')`, letto da `en.json`. Se cambia un testo non si rompono; se sparisce una chiave falliscono. Il browser gira in `en-US`.

## Trappole Ionic scoperte scrivendo i test

- Le pagine già visitate restano nel DOM con `ion-page-hidden` (`display: none`): usare `visible()` di `support/ionic.ts` per i testi.
- **Durante una transizione la pagina precedente è ancora visibile.** "30.00 EUR" compare sia nella lista sia nel dettaglio: meglio un locator per ruolo (`heading`) o un testo che esiste solo nella pagina di arrivo.
- Con più modali aperte, quella in primo piano è l'ultima `ion-modal` (`topModal()`).
- Il nome accessibile di un `ion-item button` include icona e `ion-note` ("Split with Only you"): cercarlo per sottostringa, non con `exact`.
- Il FAB di `group-detail` non ha `aria-label`, a differenza di quelli di Activity e Gruppi. Il test usa il pulsante dello stato vuoto; dargli un'etichetta aiuterebbe anche l'MCP e gli screen reader.
- `--repeat-each` fallisce per costruzione: il database si azzera per esecuzione, non per test, quindi i saldi si sommano. E le ripetizioni girano in parallelo con lo stesso utente, quindi anche i login si pestano i codici a vicenda.

## Limiti noti

- Il target `e2e-ci`, dedotto dal plugin Nx, lancia ogni file in un processo separato: in locale si contenderebbero porte e database. Si usa solo `e2e`.
- `nx typecheck splitFront-e2e` fallisce per un problema preesistente del target `typecheck` di `splitFront` (output `dist/out-tsc/**` senza `{projectRoot}`). I tipi del progetto e2e si controllano con `npx tsc -p splitFront-e2e/tsconfig.json --noEmit --composite false --declarationMap false --emitDeclarationOnly false`.
- Nessuna CI configurata, e la build nativa Capacitor non è coperta.
