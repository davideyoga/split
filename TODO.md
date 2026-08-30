# TODO

Elenco centralizzato di tutti i TODO presenti nel codice. Ogni `TODO` aggiunto nei sorgenti va riportato qui (con riferimento `file:riga`); quando un TODO viene risolto o rimosso dal codice, va tolto anche da qui. Vedi CLAUDE.md, sezione "Documenting decisions".

## Frontend (`splitFront`)

- [add-expense.html:61](splitFront/src/app/pages/add-expense/add-expense.html#L61) — permettere di scegliere chi ha pagato la spesa ("Pagata Da"); oggi si assume sempre che sia il creatore.
- [add-expense.html:62](splitFront/src/app/pages/add-expense/add-expense.html#L62) — permettere di dividere le spese in parti diseguali; oggi la divisione è sempre equa tra i contributori.

## Backend (`splitBack`)

- [group.service.ts:27](splitBack/src/app/group/group.service.ts#L27) — permessi gruppo: oggi qualsiasi membro puo' rinominare il gruppo e aggiungere/rimuovere membri. Prima della beta aggiungere `Group.createdById` (owner) e limitare le mutazioni all'owner.
- [main.ts:16](splitBack/src/main.ts#L16) — restringere CORS a un origin specifico invece di `enableCors()` aperto.
- [user.controller.ts:22](splitBack/src/app/user/user.controller.ts#L22) — la ricerca utenti dovrebbe filtrare solo utenti già registrati/confermati.
- [expense.service.ts:78](splitBack/src/app/expense/expense.service.ts#L78) — permettere quote diverse invece di una divisione sempre equa tra i contributori (creatore + partecipanti + membri del gruppo).
- [expense.service.ts:79](splitBack/src/app/expense/expense.service.ts#L79) — gestire l'arrotondamento quando `amount` non è divisibile esattamente per il numero di contributori (vale anche per lo split di gruppo: la somma delle `share` potrebbe non coincidere con `amount`).
