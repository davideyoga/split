# TODO

Elenco centralizzato di tutti i TODO presenti nel codice. Ogni `TODO` aggiunto nei sorgenti va riportato qui (con riferimento `file:riga`); quando un TODO viene risolto o rimosso dal codice, va tolto anche da qui. Vedi CLAUDE.md, sezione "Documenting decisions".

## Frontend (`splitFront`)

- [add-expense.html:61](splitFront/src/app/pages/add-expense/add-expense.html#L61) — permettere di scegliere chi ha pagato la spesa ("Pagata Da"); oggi si assume sempre che sia il creatore.
- [add-expense.html:62](splitFront/src/app/pages/add-expense/add-expense.html#L62) — permettere di dividere le spese in parti diseguali; oggi la divisione è sempre equa tra i contributori.
- [auth.interceptor.ts:5](splitFront/src/app/services/auth.interceptor.ts#L5) — gestire il 401: con token scaduto/non valido i service fanno `catchError -> of([])` e l'app mostra liste vuote invece di rimandare al login. Serve un `catchError` nell'interceptor che faccia `logout()` + redirect a `/login`.

## Backend (`splitBack`)

- [group.service.ts:27](splitBack/src/app/group/group.service.ts#L27) — permessi gruppo: oggi qualsiasi membro puo' rinominare il gruppo e aggiungere/rimuovere membri. Prima della beta aggiungere `Group.createdById` (owner) e limitare le mutazioni all'owner.
- [main.ts:16](splitBack/src/main.ts#L16) — restringere CORS a un origin specifico invece di `enableCors()` aperto.
- [user.controller.ts:22](splitBack/src/app/user/user.controller.ts#L22) — la ricerca utenti dovrebbe filtrare solo utenti già registrati/confermati.
- [expense.service.ts:78](splitBack/src/app/expense/expense.service.ts#L78) — permettere quote diverse invece di una divisione sempre equa tra i contributori (creatore + partecipanti + membri del gruppo).
- [expense.service.ts:79](splitBack/src/app/expense/expense.service.ts#L79) — gestire l'arrotondamento quando `amount` non è divisibile esattamente per il numero di contributori (vale anche per lo split di gruppo: la somma delle `share` potrebbe non coincidere con `amount`).


## Funzionalita' da aggiungere
- **Rimborsi / saldare i debiti (Priorita' Alta)**: il componente `expense-balances` mostra i saldi cumulativi ma non esiste nessun modo di azzerarli quando qualcuno restituisce i soldi. Non e' aggirabile registrando il rimborso come spesa, perche' `POST /api/expense` mette sempre il creatore fra i contributori e divide in parti uguali (un rimborso da 15 EUR ne compenserebbe 7,50). Serve il pagante selezionabile e/o le quote diseguali (vedi i due TODO su `expense.service.ts`), oppure un modello `Settlement` dedicato. Vedi CLAUDE.md, sezione "Balances".
- Saldi completi di gruppo (Priorita' Bassa): oggi `expense-balances` e' me-centrico. La matrice "chi deve a chi" fra tutti i membri e' calcolabile solo sulle spese di gruppo (`GET /api/expense/group/:publicId`, dataset completo), e va decisa fra debiti diretti e debiti semplificati.
- Aggiungere valuta (Priorita' Bassa)
- Categorizzazione per-utente delle spese condivise (Priorita' Bassa): oggi la categoria e' della spesa, quindi su una spesa di gruppo tutti i partecipanti vedono quella scelta da chi l'ha creata. In una V3.x si potrebbe permettere a ogni partecipante di categorizzare la spesa a modo suo per le proprie statistiche (servirebbe una tabella tipo `ExpenseCategoryPerUser`). Vedi [doc/funzionalita_In_Corso/categorie_spese](doc/funzionalita_In_Corso/categorie_spese), decisione 2.