# TODO

Elenco centralizzato di tutti i TODO presenti nel codice. Ogni `TODO` aggiunto nei sorgenti va riportato qui (con riferimento `file:riga`); quando un TODO viene risolto o rimosso dal codice, va tolto anche da qui. Vedi CLAUDE.md, sezione "Documenting decisions".

## Frontend (`splitFront`)

- [expense-form.modal.html:120](splitFront/src/app/pages/expense-form/expense-form.modal.html#L120) — permettere di dividere le spese in parti diseguali; oggi la divisione è sempre equa tra i contributori (la riga "Divisione" della modale è solo informativa).
- [expense-detail.page.ts:84](splitFront/src/app/pages/expense-detail/expense-detail.page.ts#L84) — il dettaglio spesa ricarica l'intera lista (`GET /api/expense` o `GET /api/expense/group/:publicId`) e cerca la spesa per `id`, perche' non esiste `GET /api/expense/:id`. Sostituire quando l'endpoint arriva (vedi "Modificare ed eliminare le spese" sotto).

## Backend (`splitBack`)

- [expense.service.ts:30](splitBack/src/app/expense/expense.service.ts#L30) (`findMine`, anche righe 41, 70 e 81 in `findByGroup`) — **esposizione dati utente (priorita' alta)**: `paidBy: true` e `expenseContributions: { include: { user: true } }` restituiscono l'intera riga `User` del pagante e di ogni contributore, quindi chiunque veda una spesa riceve email, `id` interno e `refreshToken` degli altri partecipanti. Limitare i campi con `select: { publicId: true, nickName: true }`, come gia' fa `GroupService.toResponse` per i membri. Il frontend usa solo `publicId` e `nickName` (`User.email` e' opzionale nel model), quindi non serve toccarlo.
- [group.service.ts:27](splitBack/src/app/group/group.service.ts#L27) — permessi gruppo: oggi qualsiasi membro puo' rinominare il gruppo e aggiungere/rimuovere membri. Prima della beta aggiungere `Group.createdById` (owner) e limitare le mutazioni all'owner.
- [main.ts:16](splitBack/src/main.ts#L16) — restringere CORS a un origin specifico invece di `enableCors()` aperto.
- [user.controller.ts:22](splitBack/src/app/user/user.controller.ts#L22) — la ricerca utenti dovrebbe filtrare solo utenti già registrati/confermati.
- [expense.service.ts:162](splitBack/src/app/expense/expense.service.ts#L162) — permettere quote diverse invece di una divisione sempre equa tra i contributori (creatore + partecipanti + membri del gruppo).
- [expense.service.ts:163](splitBack/src/app/expense/expense.service.ts#L163) — gestire l'arrotondamento quando `amount` non è divisibile esattamente per il numero di contributori (vale anche per lo split di gruppo: la somma delle `share` potrebbe non coincidere con `amount`).


## Funzionalita' da aggiungere
- Saldare i debiti: il componente `expense-balances` mostra i saldi cumulativi ma non esiste nessun modo di azzerarli quando qualcuno restituisce i soldi. Non e' aggirabile registrando il rimborso come spesa: il pagante ora e' selezionabile, ma `POST /api/expense` mette comunque sempre il creatore fra i contributori e divide in parti uguali (un rimborso da 15 EUR ne compenserebbe 7,50), e il pagante deve essere uno dei contributori. Servono le quote diseguali (vedi il TODO su `expense.service.ts`), oppure un modello `Settlement` dedicato. Vedi CLAUDE.md, sezione "Balances".

- Modificare ed eliminare le spese: oggi `/api/expense` espone solo `GET` e `POST`, quindi una spesa inserita per errore resta per sempre (e sporca i saldi). Servono `GET/PATCH/DELETE /api/expense/:id` (chiave `publicId`, da aggiungere a `Expense` come per `User`/`Group`), la ricostruzione delle `ExpenseContribution` al cambio di importo/partecipanti, e la modalita' "modifica" di `ExpenseFormModal` (oggi solo creazione, vedi CLAUDE.md, "Navigation shell", Fase 2 - - da decidere a inizio Fase 3). Da decidere anche chi puo' modificare/eliminare (solo il creatore? qualsiasi contributore?) e se l'eliminazione e' soft, come per le categorie.



- Saldi completi di gruppo (Priorita' Bassa): oggi `expense-balances` e' me-centrico. La matrice "chi deve a chi" fra tutti i membri e' calcolabile solo sulle spese di gruppo (`GET /api/expense/group/:publicId`, dataset completo), e va decisa fra debiti diretti e debiti semplificati.

- Aggiungere valuta (Priorita' Bassa)

- Categorizzazione per-utente delle spese condivise (Priorita' Bassa): oggi la categoria e' della spesa, quindi su una spesa di gruppo tutti i partecipanti vedono quella scelta da chi l'ha creata. In una V3.x si potrebbe permettere a ogni partecipante di categorizzare la spesa a modo suo per le proprie statistiche (servirebbe una tabella tipo `ExpenseCategoryPerUser`). Vedi [doc/funzionalita_In_Corso/categorie_spese](doc/funzionalita_In_Corso/categorie_spese), decisione 2.

- Data della spesa (Priorita' Bassa): `Expense` ha solo `createdDate` (momento dell'inserimento), quindi una spesa registrata a posteriori (es. a fine viaggio) risulta con la data sbagliata. Aggiungere un campo `date` (default oggi, modificabile nella modale) e ordinare le liste per quella invece che per `createdDate`.