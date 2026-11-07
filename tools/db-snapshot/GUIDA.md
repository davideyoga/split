# Snapshot del database: guida rapida

Copia il database di produzione (Neon) sul PC in due forme: un file `.dump` per ripristinarlo e un CSV per ogni tabella. Tutti i dettagli sono in [README.md](README.md).

## Una volta sola

1. Tieni Docker acceso: lo usi già per il DB di sviluppo.
2. In `.env` (root del repo) aggiungi la stringa di connessione di Neon, presa dal pannello Neon → *Connect*:
   ```
   SNAPSHOT_DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
   ```

## Ogni volta, dalla root del repo

```
npm run db:snapshot                         # snapshot
npm run db:snapshot -- prima-del-deploy     # snapshot con un'etichetta nel nome
```

Il risultato finisce in `db-snapshots/<nome>/`:

```
<nome>.dump    ← per il ripristino
csv/           ← un file .csv per tabella
```

## Quando serve

```
npm run db:restore -- db-snapshots/<nome> split-db-neon   # carica la copia nel Postgres locale
npm run db:csv -- db-snapshots/<nome>                     # rigenera i CSV dal .dump
```

Il ripristino funziona solo verso il Postgres locale, e prima chiede di riscrivere il nome del database. Se quel database esiste già, viene cancellato e ricreato.

## Se il database cambia

Non c'è niente da aggiornare: tabelle e colonne nuove o tolte compaiono e spariscono da sole, nel `.dump` e nei CSV. Anche una nuova versione di Postgres su Neon viene riconosciuta da sola.

**Unica eccezione:** se aggiungi una tabella con dei segreti (token, credenziali) o rinomini `Session`/`Verification`, aggiorna la lista `SKIP_DATA` in `snapshot.mts`. È la lista delle tabelle di cui non si salvano i dati.

## Se qualcosa va storto

- **`docker non trovato`, o errori di connessione a Docker:** avvia Docker.
- **`SNAPSHOT_DATABASE_URL non impostato`:** manca la riga in `.env`.
- **Una cartella `….partial` in `db-snapshots/`:** lo snapshot si è interrotto. Cancellala e rilancialo.
- **Il CSV in Excel finisce tutto in una colonna:** aprilo da *Dati → Da testo/CSV* e scegli virgola e UTF-8.

**Attenzione:** gli snapshot contengono dati veri degli utenti. Non condividerli e non metterli su git (`db-snapshots/` è già esclusa).
