# TODO

Elenco centralizzato di tutti i TODO presenti nel codice. Ogni `TODO` aggiunto nei sorgenti va riportato qui (con riferimento `file:riga`); quando un TODO viene risolto o rimosso dal codice, va tolto anche da qui. Vedi CLAUDE.md, sezione "Documenting decisions".

## Frontend (`splitFront`)

- (nessuno)

## Backend (`splitBack`)

- [group.service.ts:27](splitBack/src/app/group/group.service.ts#L27) — permessi gruppo: oggi qualsiasi membro puo' rinominare il gruppo e aggiungere/rimuovere membri. Prima della beta aggiungere `Group.createdById` (owner) e limitare le mutazioni all'owner.
- [main.ts:21](splitBack/src/main.ts#L21) — restringere CORS a un origin specifico invece di `enableCors()` aperto.
- [user.controller.ts:22](splitBack/src/app/user/user.controller.ts#L22) — la ricerca utenti dovrebbe filtrare solo utenti già registrati/confermati.


## Funzionalita' da aggiungere Priorita' alta
- Saldare i debiti: il componente `expense-balances` mostra i saldi cumulativi ma non esiste nessun modo di azzerarli quando qualcuno restituisce i soldi. Con le quote diseguali (2026-09-26) si puo' aggirare registrando il rimborso come spesa (pagante = chi restituisce, quota 0 a lui e l'intero importo a chi riceve), ma e' un ripiego: il rimborso compare fra le spese. Serve un modello `Settlement` dedicato. Vedi CLAUDE.md, sezione "Balances".


## Funzionalita' da aggiungere priorita' bassa
- Saldi completi di gruppo (Priorita' Bassa): oggi `expense-balances` e' me-centrico. La matrice "chi deve a chi" fra tutti i membri e' calcolabile solo sulle spese di gruppo (`GET /api/expense/group/:publicId`, dataset completo), e va decisa fra debiti diretti e debiti semplificati.

- Aggiungere valuta (Priorita' Bassa)

- Categorizzazione per-utente delle spese condivise (Priorita' Bassa): oggi la categoria e' della spesa, quindi su una spesa di gruppo tutti i partecipanti vedono quella scelta da chi l'ha creata. In una V3.x si potrebbe permettere a ogni partecipante di categorizzare la spesa a modo suo per le proprie statistiche (servirebbe una tabella tipo `ExpenseCategoryPerUser`). Vedi [doc/funzionalita_In_Corso/categorie_spese](doc/funzionalita_In_Corso/categorie_spese), decisione 2.

- Data della spesa (Priorita' Bassa): `Expense` ha solo `createdDate` (momento dell'inserimento), quindi una spesa registrata a posteriori (es. a fine viaggio) risulta con la data sbagliata. Aggiungere un campo `date` (default oggi, modificabile nella modale) e ordinare le liste per quella invece che per `createdDate`.