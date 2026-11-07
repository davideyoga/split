# TODO

Elenco centralizzato di tutti i TODO presenti nel codice. Ogni `TODO` aggiunto nei sorgenti va riportato qui (con riferimento `file:riga`); quando un TODO viene risolto o rimosso dal codice, va tolto anche da qui. Vedi CLAUDE.md, sezione "Documenting decisions".

## Frontend (`splitFront`)

- (nessuno)

## Backend (`splitBack`)

- [group.service.ts:26](splitBack/src/app/group/group.service.ts#L26) — permessi gruppo: oggi qualsiasi membro puo' rinominare il gruppo, creare o revocare il link d'invito e rimuovere membri. Prima della beta aggiungere `Group.createdById` (owner) e limitare le mutazioni all'owner.
- [auth.factory.ts:15](splitBack/src/app/auth/auth.factory.ts#L15) — prima della beta: dietro un reverse proxy il rate limit del login vede solo l'IP del proxy (un contatore per tutti); leggere `X-Forwarded-For` con `advanced.ipAddress.trustedProxies`.


## Funzionalita' da aggiungere Priorita' alta
- Piano in [doc/InvitiGruppo.md](doc/InvitiGruppo.md) (2026-11-07): fatte tutte e quattro le fasi (A via gli amici, B link d'invito, C "Blocca" ed "Esci dal gruppo", D registrazione aperta dal branch `registration`). Ospiti senza account: estensione futura.
- Registrazione (2026-11-07, branch `registration`: codice via email, Google, Apple, collegamento per email, `/welcome`; vedi CLAUDE.md, "Registration"). Manca, **prima di impostare `AUTH_SIGN_UP=open` in produzione**:
  - eliminazione dell'account e informativa privacy (GDPR). L'informativa serve anche a Google per pubblicare la schermata di consenso OAuth fuori dalla modalita' "Testing";
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


- Nickname liberati da un rename (priorita' media, prima della beta): oggi un nickname appena lasciato puo' essere preso subito da un altro utente, e chi cerca il vecchio nome aggiunge alla spesa la persona sbagliata. Possibili rimedi: riservare per qualche settimana i nickname liberati, o un limite di cambi. Vedi CLAUDE.md, "Nickname".


## Funzionalita' da aggiungere priorita' bassa
- Saldi completi di gruppo (Priorita' Bassa): oggi `expense-balances` e' me-centrico. La matrice "chi deve a chi" fra tutti i membri e' calcolabile solo sulle spese di gruppo (`GET /api/expense/group/:publicId`, dataset completo), e va decisa fra debiti diretti e debiti semplificati.

- Aggiungere valuta (Priorita' Bassa)

- Categorizzazione per-utente delle spese condivise (Priorita' Bassa): oggi la categoria e' della spesa, quindi su una spesa di gruppo tutti i partecipanti vedono quella scelta da chi l'ha creata. In una V3.x si potrebbe permettere a ogni partecipante di categorizzare la spesa a modo suo per le proprie statistiche (servirebbe una tabella tipo `ExpenseCategoryPerUser`). Vedi [doc/funzionalita_In_Corso/categorie_spese](doc/funzionalita_In_Corso/categorie_spese), decisione 2.

- Data della spesa (Priorita' Bassa): `Expense` ha solo `createdDate` (momento dell'inserimento), quindi una spesa registrata a posteriori (es. a fine viaggio) risulta con la data sbagliata. Aggiungere un campo `date` (default oggi, modificabile nella modale) e ordinare le liste per quella invece che per `createdDate`.

- Da valutare se dare la possibilita' di aggiungere spese personali al gruppo in modo da sapere quanto si e' speso per persona in quel viaggio 





## Bug riscontrati durante l'alpha:
se premo +, si apre pannello nuova spesa ma poi se premo bottone indietro mi va su una schermata vuota