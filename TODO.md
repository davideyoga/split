# TODO

Elenco centralizzato di tutti i TODO presenti nel codice. Ogni `TODO` aggiunto nei sorgenti va riportato qui (con riferimento `file:riga`); quando un TODO viene risolto o rimosso dal codice, va tolto anche da qui. Vedi CLAUDE.md, sezione "Documenting decisions".

## Frontend (`splitFront`)

- [select-participant.component.ts:45](splitFront/src/app/components/select-participant/select-participant.component.ts#L45) — passare l'intero `User` selezionato, non solo l'email.
- [add-expense.html:37](splitFront/src/app/pages/add-expense/add-expense.html#L37) — permettere di scegliere chi ha pagato la spesa ("Pagata Da"); oggi si assume sempre che sia il creatore.
- [add-expense.html:38](splitFront/src/app/pages/add-expense/add-expense.html#L38) — permettere di dividere le spese in parti diseguali; oggi la divisione è sempre equa tra creatore e partecipanti.
- [add-expense.html:70](splitFront/src/app/pages/add-expense/add-expense.html#L70) — l'icona "x" per rimuovere un partecipante non è visibile.
- [add-expense.ts:78](splitFront/src/app/pages/add-expense/add-expense.ts#L78) — impedire di selezionare due volte lo stesso utente come partecipante.

## Backend (`splitBack`)

- [main.ts:16](splitBack/src/main.ts#L16) — restringere CORS a un origin specifico invece di `enableCors()` aperto.
- [user.controller.ts:22](splitBack/src/app/user/user.controller.ts#L22) — la ricerca utenti dovrebbe filtrare solo utenti già registrati/confermati.
- [expense.service.ts](splitBack/src/app/expense/expense.service.ts) — permettere quote diverse invece di una divisione sempre equa tra i partecipanti.
- [expense.service.ts](splitBack/src/app/expense/expense.service.ts) — gestire l'arrotondamento quando `amount` non è divisibile esattamente per il numero di partecipanti (la somma delle `share` potrebbe non coincidere con `amount`).
