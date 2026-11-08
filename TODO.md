# TODO

Elenco centralizzato di tutti i TODO presenti nel codice. Ogni `TODO` aggiunto nei sorgenti va riportato qui (con riferimento `file:riga`); quando un TODO viene risolto o rimosso dal codice, va tolto anche da qui. Vedi CLAUDE.md, sezione "Documenting decisions".

## Frontend (`splitFront`)

- (nessuno)

## Backend (`splitBack`)

- [group.service.ts:26](splitBack/src/app/group/group.service.ts#L26) — permessi gruppo: oggi qualsiasi membro puo' rinominare il gruppo, creare o revocare il link d'invito e rimuovere membri. Prima della beta aggiungere `Group.createdById` (owner) e limitare le mutazioni all'owner.


## Funzionalita' da aggiungere Priorita' alta
- Registrazione (codice via email, Google, Apple, collegamento per email, `/welcome`; vedi CLAUDE.md, "Registration"). Manca, **prima di impostare `AUTH_SIGN_UP=open` in produzione**:
  - pubblicare l'informativa privacy nell'app ([doc/privacy/](doc/privacy/), mancano titolare, contatto e data). Serve anche a Google per pubblicare la schermata di consenso OAuth fuori dalla modalita' "Testing";
  - captcha (plugin `captcha` di Better Auth) se arrivano abusi: chiunque puo' far mandare codici a indirizzi a caso, e Brevo gratuito si ferma a ~300 email al giorno.
- Login con Google e Apple nell'app nativa (Capacitor): oggi solo web/PWA. Nella WebView Google rifiuta il login (`disallowed_useragent`) e il JS di Apple non e' pensato per le app: servono plugin nativi open source che restituiscano l'ID token, e i loro client ID (Android/iOS) aggiunti a `GOOGLE_CLIENT_ID` / `APPLE_APP_BUNDLE_IDENTIFIER`. Vedi [doc/Auth.md](doc/Auth.md).
- Login con Apple: per ora non si puo' provare (2026-11-07), quindi resta fuori dal test book. Con "Nascondi la mia email" Apple da' un indirizzo `@privaterelay.appleid.com`, diverso da quello usato col codice, quindi nasce un secondo account invece di collegarsi al primo. Rimedio possibile: collegare Apple dal Profilo, a sessione aperta (`/link-social` con ID token e `allowDifferentEmails`).
- Passkey (accesso con impronta/FaceID dopo il primo login via codice): plugin `@better-auth/passkey` (MIT), aggiunge una tabella. Su Capacitor serve un plugin nativo open source e la configurazione del dominio (`assetlinks.json` / `apple-app-site-association`). Vedi [doc/Auth.md](doc/Auth.md).
- Dominio per le email: con Brevo e mittente Gmail i codici di login possono finire in spam; con un dominio autenticato in Brevo (SPF/DKIM) no.
- Notifiche push: agganciarle all'unico punto di creazione, `NotificationService.notify()`, dopo il commit della transazione. Il testo della push lo genera il server, quindi serve la lingua dell'utente salvata sul server (`User.locale`; oggi e' solo in localStorage). Vedi CLAUDE.md, "Notifications".
- Notifiche, limiti dell'alpha (priorita' bassa):
  - nessuna notifica si cancella mai (se ne mostrano le ultime 50): serve una pulizia di quelle vecchie;
  - il numero sulla campanella non si aggiorna da solo mentre l'app resta aperta sulla stessa pagina (con le push non servira');
  - mancano le notifiche per la rinomina di un gruppo e per un rimborso eliminato.
- Rate limit su `GET /api/user`: fatto il 2026-11-07 (30 ricerche all'ora per utente, `search-rate-limit.guard.ts`), ma in memoria come quello del login: si azzera a ogni riavvio e vale per un solo processo. Se l'API gira su piu' istanze, spostarlo su storage condiviso. Il frontend (`select-participant`) mostra il 429 come "Troppe ricerche".
- Link d'invito nell'app nativa (Capacitor): il link usa `window.location.origin`, che li' e' `https://localhost`. Serve l'URL pubblico del sito (es. in `environment`) e il deep link `/join` configurato in Android/iOS.


- Nickname liberati da un rename (priorita' media, prima della beta): oggi un nickname appena lasciato puo' essere preso subito da un altro utente, e chi cerca il vecchio nome aggiunge alla spesa la persona sbagliata. Possibili rimedi: riservare per qualche settimana i nickname liberati, o un limite di cambi. Restano possibili anche i nickname simili (`Pippo`/`Pipp0`/`Pip.po`). Vedi CLAUDE.md, "Nickname".


## Funzionalita' da aggiungere priorita' bassa
- Saldi completi di gruppo (Priorita' Bassa): il calcolo esiste gia' (`computeGroupDebts` e `simplifyDebts` in `splitFront/src/app/utils/simplify.ts`), ma si vede solo nell'anteprima di Smart split. Il segmento Saldi del gruppo resta me-centrico (`expense-balances`): manca una vista permanente di "chi deve a chi" fra tutti i membri, e va deciso se mostrare i debiti diretti o quelli semplificati.

- Aggiungere valuta (Priorita' Bassa)

- Categorizzazione per-utente delle spese condivise (Priorita' Bassa): oggi la categoria e' della spesa, quindi su una spesa di gruppo tutti i partecipanti vedono quella scelta da chi l'ha creata. In una V3.x si potrebbe permettere a ogni partecipante di categorizzare la spesa a modo suo per le proprie statistiche (servirebbe una tabella tipo `ExpenseCategoryPerUser`). L'analisi e' stata tolta dal repo, si legge con `git show 9433411^:doc/funzionalita_In_Corso/categorie_spese` (decisione 2).

- Ospiti senza account (Priorita' Bassa): potrebbero solo aggiungere le proprie spese a quel gruppo e vederne spese e saldi. Estensione futura, vedi [doc/InvitiGruppo.md](doc/InvitiGruppo.md).

- Paginazione (Priorita' Bassa): `GET /api/expense` e `GET /api/group` restituiscono tutto. Attenzione: "Speso questo mese", la pagina Spese e i saldi si calcolano nel frontend su tutte le spese dell'utente, quindi paginare `GET /api/expense` richiede di spostare o rivedere quei calcoli.

- Storico delle modifiche alle spese (Priorita' Bassa): qualsiasi partecipante puo' modificare o eliminare una spesa e non resta traccia di chi l'ha fatto. E' la prima cosa da aggiungere se i tester contestano delle modifiche.

- Giorno di inizio del mese (Priorita' Bassa): e' salvato solo sul dispositivo (`split.monthStartDay`), quindi non segue l'utente su un altro telefono o PC. Per sincronizzarlo serve una colonna su `User` e `PATCH /api/user/me`.

- Pulizia delle sessioni scadute (Priorita' Bassa): Better Auth cancella una riga di `Session` scaduta solo quando quel token viene riusato, quindi su un dispositivo non piu' usato restano per sempre IP e user agent. Serve un job periodico che cancelli le righe con `expiresAt` passato. Dopo, aggiornare la riga "Sessione" del punto 7 in [doc/privacy/informativa-privacy.it.md](doc/privacy/informativa-privacy.it.md) e [doc/privacy/privacy-policy.en.md](doc/privacy/privacy-policy.en.md).

- Avviso nell'app quando cambia l'informativa privacy (da fare prima della prima modifica importante): il punto 11 di [doc/privacy/informativa-privacy.it.md](doc/privacy/informativa-privacy.it.md) e di [doc/privacy/privacy-policy.en.md](doc/privacy/privacy-policy.en.md) promette un avviso nell'app, ma oggi non esiste un meccanismo per mandarlo a tutti gli utenti. Possibile base: un nuovo tipo di notifica (`NotificationService.notify()`, vedi CLAUDE.md, "Notifications"), che pero' oggi nasce sempre dall'azione di un altro utente.

- Gestione categorie personali (Priorita' Bassa): mancano nell'interfaccia rinomina, archiviazione e scelta di icona e colore. Endpoint e colonne esistono gia'.

- Feedback dei tester ([doc/feedback](doc/feedback)): aggiungere una spesa non e' abbastanza intuitivo; il pannello saldi vuoto non e' bello da vedere.

- Da valutare se dare la possibilita' di aggiungere spese personali al gruppo in modo da sapere quanto si e' speso per persona in quel viaggio 





## Debito tecnico
- Nessuna CI: manca `.github/workflows`.
- I vincoli fra progetti Nx non sono applicati: `depConstraints` in `eslint.config.mjs` permette tutto (`'*'` → `['*']`) e nessun progetto ha `tags`, quindi nulla impedisce a `splitFront` di importare `splitBack`.
- `package.json`: `workspaces` elenca `splitBack-e2e`, che non esiste.
- `data-access/` non e' importato da nessuno: i tipi sono duplicati a mano fra frontend e backend.


## Bug riscontrati durante l'alpha:
- Tasto indietro con la modale "Nuova spesa" aperta (browser/PWA, riprodotto il 2026-11-08): se premo + e poi indietro, la modale non si chiude. Sotto cambia la pagina (la tab o il gruppo precedente, oppure `/login` se ero appena entrato) e il form resta sopra. Se l'app e' la prima voce della cronologia si esce dall'app: probabile origine della schermata vuota segnalata. Da provare anche sull'app nativa (Capacitor).
- [group.service.ts:93](splitBack/src/app/group/group.service.ts#L93) — gruppo orfano: `removeMember` lascia uscire anche l'ultimo membro, e il gruppo resta nel DB senza che nessuno possa piu' accedervi.
- [group.service.ts:16](splitFront/src/app/services/group.service.ts#L16) — `getMyGroups` trasforma ogni errore in `[]`: se il caricamento fallisce si legge "nessun gruppo" invece di un errore.