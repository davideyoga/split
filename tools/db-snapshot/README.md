# Snapshot del database

Data: 2026-11-07. Stato: **implementato**, provato in locale (vedi "Prove"); non ancora lanciato sul Neon vero.

> Per lanciarlo e basta: [GUIDA.md](GUIDA.md). Questo file contiene i dettagli e le scelte fatte.

Un comando salva sul PC una copia completa del database di produzione (Neon), in due forme:

- un file **`.dump`** per ripristinarlo;
- una cartella di **CSV**, un file per tabella, per guardare o analizzare i dati.

Si lancia a mano quando serve, per esempio prima di un deploy con una migrazione, o prima di toccare i dati a mano.

## Prima volta

1. **Docker attivo.** `pg_dump`/`pg_restore` non sono installati sul PC: gli script li fanno girare nell'immagine `postgres:<versione>-alpine`, che Docker scarica la prima volta (circa 100 MB). Docker serve già per il DB di sviluppo (container `split-db`).
2. **La stringa di Neon in `.env`**, nella variabile `SNAPSHOT_DATABASE_URL` (esempio in `.env.example`). Si prende dal pannello di Neon, *Connect*. Va bene quella **diretta**, senza `-pooler` nell'host. Se incolli quella del pooler, lo script la converte da solo, perché `pg_dump` non va fatto attraverso PgBouncer.

`SNAPSHOT_DATABASE_URL` è una variabile a parte, non `DATABASE_URL`, così il backend di sviluppo non può finire collegato alla produzione per sbaglio. La legge solo lo script di snapshot.

## Fare uno snapshot

```
npm run db:snapshot
npm run db:snapshot -- prima-della-migrazione   # etichetta facoltativa nel nome
```

Ogni snapshot è una cartella in `db-snapshots/`. Il nome contiene database, host, data e ora locali, l'etichetta e la versione di Postgres del server:

```
db-snapshots/neondb_ep-cool-name-123456_2026-11-07_153012_pg17/
├── neondb_ep-cool-name-123456_2026-11-07_153012_pg17.dump   ← per il ripristino
└── csv/
    ├── User.csv
    ├── Expense.csv
    ├── ExpenseContribution.csv
    └── …                                                     ← una tabella per file
```

- **Sola lettura:** su Neon lo script non modifica niente, e lo legge una volta sola: i CSV si ricavano dal `.dump`. Se il database è in pausa lo sveglia, e consuma pochi secondi di calcolo.
- **Snapshot interrotti:** tutto si scrive prima in una cartella `.partial`, rinominata solo alla fine. Se trovi una `.partial`, lo snapshot non è andato a buon fine e puoi cancellarla.
- **Un altro database:** `SNAPSHOT_DATABASE_URL='<stringa>' npm run db:snapshot`. Una variabile già impostata nel terminale vince su quella di `.env`.

### Il file `.dump`

È il formato "custom" di `pg_dump`: binario e compresso. Per il DB di oggi pesa circa 50 KB. Contiene tutto lo schema e tutti i dati, compresa `_prisma_migrations`, da cui si vede a quale migrazione era il DB.

**Esclusi i dati di `Session` e `Verification`**, di cui resta solo la tabella vuota:

- `Session` contiene i token delle sessioni in chiaro, e con uno di quelli si entra come quell'utente per 30 giorni;
- `Verification` contiene solo codici di login che scadono in 10 minuti.

Conseguenza: dopo un ripristino tutti devono rifare il login.

### I CSV

Un file per tabella, con una riga di intestazione con i nomi delle colonne. `Session` e `Verification` non hanno un file, perché il dump non ne contiene i dati.

- **Formato:** UTF-8, separatore virgola, valori tra virgolette solo se serve. È lo stesso CSV che produce Postgres con `COPY … CSV HEADER`, byte per byte (verificato).
- **NULL e testo vuoto:** NULL è un campo vuoto, il testo vuoto è `""`.
- **I valori sono quelli di Postgres:**
  - date e orari in UTC (`2026-08-31 20:20:26.717`);
  - booleani `t`/`f`;
  - importi con 30 decimali (`3.000000000000000000000000000000`), perché la colonna è `DECIMAL(65,30)`, il default di Prisma.
- **Formule neutralizzate:** un testo che comincia con `=`, `+`, `-` o `@` (e non è un numero) prende un `'` davanti, per esempio `'=HYPERLINK(…)`. Descrizioni, note e nomi di categoria li scrivono gli utenti, e aperti in Excel o LibreOffice verrebbero eseguiti come formule. Il `.dump` invece conserva il valore originale.
- **Excel in italiano** si aspetta il `;` come separatore: aprendo il file con un doppio clic metterebbe tutto in una colonna. Usa *Dati → Da testo/CSV* e scegli virgola e UTF-8. In LibreOffice la finestra di importazione chiede il separatore. Se i numeri col punto vengono letti male, imposta come lingua della colonna "Inglese (USA)".

**Rigenerare i CSV** da un dump, se la conversione era fallita (lo snapshot lo segnala e tiene comunque il `.dump`) o per un dump senza cartella `csv/`. Non tocca nessun database:

```
npm run db:csv -- db-snapshots/<snapshot>
```

Si rifiuta se `csv/` esiste già: cancellala prima.

### Sicurezza

- Gli snapshot contengono **dati veri**: email, nickname, spese. `db-snapshots/` è nel `.gitignore`, e lo script crea cartelle con permessi `700` e file con `600`, leggibili solo dal tuo utente. Non condividerli, e non caricarli su un servizio esterno senza cifrarli.
- La password di Neon passa a Docker come variabile d'ambiente, non come argomento, quindi non compare in `ps`.

### Limiti

- **Le copie stanno solo su questo PC**: se il disco si rompe, si perdono anche loro. Per una copia davvero al sicuro, spostale ogni tanto su un disco esterno o su un cloud, cifrate.
- **Niente rotazione:** gli snapshot vecchi si cancellano a mano.
- **Niente automazione:** per ora si lancia a mano. Il passo successivo naturale sarebbe un cron o una GitHub Action pianificata.

## Ripristinare

### Nel Postgres locale (comando)

```
npm run db:restore -- db-snapshots/<snapshot> split-db-neon
```

- Il primo argomento è la cartella dello snapshot, o direttamente il suo `.dump`.
- Il secondo è il database **locale** da creare. Se esiste già, viene **cancellato e ricreato**, dopo aver chiesto di riscriverne il nome per conferma.
- Usa un nome nuovo, come `split-db-neon`, per guardare i dati di produzione senza toccare il tuo `split-db`.
- Per aprirli nell'app: in `.env` metti `DATABASE_URL` su quel database, poi riavvia `nx serve splitBack`. Le sessioni non ci sono, quindi per entrare serve `MAIL_TRANSPORT=console` (il codice compare nel log del server).
- Il server di destinazione è quello di `DATABASE_URL` in `.env`, e **lo script si rifiuta di ripristinare su un host che non sia localhost**.
- Se lo snapshot è più vecchio delle migrazioni attuali, applicale dopo il ripristino: da `splitBack/`, `set -a && . ../.env && set +a && npx prisma migrate deploy`, con `DATABASE_URL` che punta al database ripristinato.

### Su Neon (a mano, di proposito)

Ripristinare su Neon sovrascrive la produzione, per questo non c'è un comando. Prima di tutto guarda se basta il ripristino di Neon stesso: nel pannello del branch, *Restore*, con una finestra di tempo che dipende dal piano. Per un errore recente è la strada più rapida.

Se invece serve proprio lo snapshot:

1. Crea su Neon un database **nuovo e vuoto**, o un branch nuovo, e prendi la sua stringa di connessione.
2. Ripristina lì il `.dump`. Usa un'immagine della stessa versione indicata dal `_pgN` nel nome:
   ```
   docker run --rm -it --network host \
     -v "$PWD/db-snapshots/<snapshot>/<snapshot>.dump:/snapshot.dump:ro" \
     postgres:17-alpine pg_restore --no-owner --no-privileges --exit-on-error --single-transaction \
     --dbname='<stringa del database nuovo>' /snapshot.dump
   ```
   La stringa deve avere solo parametri di libpq (`sslmode`, `channel_binding`, …), non quelli di Prisma come `schema=public`.
3. Controlla i dati, poi punta il `DATABASE_URL` di Render al database nuovo.

**Questo comando non è ancora stato provato su Neon.**

## Se il database cambia

Gli script non contengono un elenco di tabelle o colonne: leggono quello che c'è nel database (`pg_dump`) e nel dump (i CSV). Quando lo schema cambia, quindi, non va toccato niente:

- **Tabelle o colonne nuove o tolte:** escono da sole nel `.dump` e nei CSV. Durante le prove una tabella aggiunta e poi tolta nel DB di sviluppo è comparsa e sparita dai CSV senza modifiche.
- **Nuova versione di Postgres su Neon:** lo script la legge a ogni esecuzione e usa l'immagine Docker giusta, scaricata la prima volta.
- **Snapshot vecchi:** restano validi e si ripristinano con lo schema di allora. Dopo il ripristino, `prisma migrate deploy` lo porta allo schema attuale; lo script lo ricorda.

**L'unica cosa da tenere d'occhio è `SKIP_DATA` in `snapshot.mts`**, la lista delle tabelle di cui non si salvano i dati (oggi `Session` e `Verification`):

- se una tabella nuova contiene segreti, per esempio token di accesso o di login social in `Account`, va aggiunta a quella lista;
- se `Session` o `Verification` cambiano nome, la lista va aggiornata: con un nome che non esiste più, `pg_dump` non dà errore e salva i dati della tabella rinominata.

## Come funziona

Il codice è in questa cartella: `snapshot.mts`, `restore.mts`, `csv.mts` e la parte comune `pg-tools.mts`. Gli script girano con `node` e sono collegati agli script npm della root.

- **Versione del client:** `pg_dump` si rifiuta di leggere un server più nuovo di lui, e il DB locale (Postgres 15) e Neon non hanno per forza la stessa versione. Per questo lo script chiede prima la versione al server, con Prisma e `server_version_num`, e usa `postgres:<quella>-alpine`.
  - Il restore usa la più alta tra la versione del server locale e il `_pgN` del file, perché `pg_restore` non legge archivi di un `pg_dump` più nuovo.
  - Il CSV usa il `_pgN` del file.
- **Stringa di connessione → variabili `PG*`:** la stringa di Prisma può contenere parametri che libpq rifiuta (`schema`, `connection_limit`, `pgbouncer`). Lo script passa solo host, porta, utente, password, database, `sslmode`, `channel_binding`, `connect_timeout` e `options`.
- **CSV dal dump:** `pg_restore --data-only` stampa i dati del dump come blocchi `COPY … FROM stdin`, nel formato testo di Postgres (tab, `\N` per NULL, escape con `\`). `dumpToCsv` in `pg-tools.mts` li converte riga per riga in CSV con le stesse regole di `COPY … CSV` di Postgres, più la neutralizzazione delle formule. Non serve un database, e i CSV corrispondono esattamente al `.dump`.
- **Restore attraverso `psql`:** `pg_restore` 17 scrive sempre `SET transaction_timeout = 0`, che Postgres 15 rifiuta, e senza correzione uno snapshot di Neon non si ripristinava nel DB locale. Il restore quindi fa produrre l'SQL a `pg_restore`, toglie quella riga e lo esegue con `psql` in un'unica transazione: un errore annulla tutto.

## Prove (2026-11-07)

Neon era simulato da un container `postgres:17-alpine` temporaneo, con i dati di sviluppo più righe difficili nelle descrizioni:

- virgole, virgolette, a capo, tab, backslash, emoji e lettere accentate;
- testo vuoto, NULL e il testo `\N`;
- `=HYPERLINK(…)`, `-2+3`, `@SUM(A1)` e `-15.50`.

Il giro: snapshot del DB di sviluppo (Postgres 15) → ripristino nel Postgres 17 → snapshot del 17, con parametri Prisma nella stringa → ripristino nel Postgres 15 locale, passando la cartella.

Risultato:

- **CSV identici byte per byte** a `COPY … TO STDOUT CSV HEADER` di Postgres su tutte le 11 tabelle, tranne i campi neutralizzati: `=HYPERLINK`, `-2+3`, `@SUM` e un `\r` iniziale prendono il `'`, mentre `-15.50` resta un numero;
- il modulo `csv` di Python rilegge i valori giusti;
- `db:csv` rigenera gli stessi file;
- il ripristino ha le stesse righe del DB di sviluppo in ogni tabella, tranne `Session` e `Verification`, vuote; `nickName` è ancora `citext`, `prisma migrate status` dice "up to date", e il dump conserva `=HYPERLINK…` senza apostrofo.

Provati anche i rifiuti:

- `SNAPSHOT_DATABASE_URL` mancante;
- etichetta non valida;
- restore verso un host remoto;
- conferma sbagliata, che non cancella niente;
- `db:csv` con `csv/` già presente.

**Non provato:** il Neon vero (SSL, `channel_binding`, pausa del DB) e il ripristino su Neon.
