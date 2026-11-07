/**
 * Ripristina uno snapshot di snapshot.mts in un database del Postgres
 * LOCALE, cancellandolo e ricreandolo da zero. Dettagli in tools/db-snapshot/README.md.
 *
 * Uso, dalla root del repo:
 *   npm run db:restore -- db-snapshots/<snapshot> <database>   # o il file .dump
 *
 * <database> e' il nome del database da (ri)creare sul server di DATABASE_URL
 * (il Postgres di sviluppo, da `.env`): un nome nuovo, es. `split-db-neon`,
 * per guardare una copia di produzione senza toccare la propria; `split-db`
 * per sostituire il DB di sviluppo con lo snapshot. Chiede di riscrivere il
 * nome per conferma.
 *
 * Solo verso localhost: ripristinare su Neon cancellerebbe i dati veri, ed e'
 * un'operazione da fare a mano (vedi il doc), non con un comando.
 */
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import {
  describe,
  dumpMajor,
  libpqEnv,
  resolveDump,
  runPgTool,
  serverMajor,
  urlFromEnv,
  withPrisma,
} from './pg-tools.mts';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

async function confirm(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const [snapshot, target] = process.argv.slice(2);
  if (!snapshot || !target) {
    throw new Error('Uso: npm run db:restore -- db-snapshots/<snapshot> <database>');
  }
  const file = resolveDump(snapshot);
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(target)) {
    throw new Error('Il nome del database puo\' avere solo lettere, numeri, "_" e "-".');
  }

  const url = urlFromEnv('DATABASE_URL', 'Serve il Postgres di sviluppo (vedi .env.example).');
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Ripristino rifiutato: ${url.hostname} non e' il Postgres locale. Vedi tools/db-snapshot/README.md.`);
  }

  const answer = await confirm(
    `Il database ${describe(url, target)} sara' CANCELLATO (se esiste) e ricreato da ${path.basename(file)}.\n` +
      `Scrivi "${target}" per confermare: `,
  );
  if (answer !== target) {
    console.log('Annullato.');
    return;
  }

  // DROP/CREATE DATABASE vanno lanciati da un altro database: quello di
  // manutenzione `postgres`. WITH (FORCE) chiude le connessioni aperte,
  // compresa quella di `nx serve splitBack` se il target e' split-db.
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const major = await withPrisma(maintenance, async (prisma) => {
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`);
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${target}"`);
    return serverMajor(prisma);
  });

  // pg_restore legge solo archivi scritti da un pg_dump della sua versione o
  // piu' vecchio: uno snapshot di Neon (es. pg17) sul Postgres locale 15 va
  // ripristinato con pg_restore 17.
  // pg_restore non scrive direttamente nel database: produce l'SQL, che psql
  // esegue in un'unica transazione (un errore annulla tutto). In mezzo si
  // toglie `SET transaction_timeout = 0`, che pg_restore >= 17 scrive sempre e
  // che un server piu' vecchio rifiuta (trovato provando pg17 -> Postgres 15).
  // --no-owner / --no-privileges: su Neon proprietario e permessi sono di
  // ruoli che in locale non esistono; qui tutto diventa dell'utente di .env.
  const restore =
    'set -eo pipefail; ' +
    'pg_restore --no-owner --no-privileges --file=- /snapshot.dump ' +
    "| grep -v '^SET transaction_timeout = ' " +
    '| psql --quiet --no-psqlrc --set=ON_ERROR_STOP=1 --single-transaction';
  await runPgTool(Math.max(major, dumpMajor(file) ?? 0), libpqEnv(url, target), ['sh', '-c', restore], {
    mounts: [`${path.resolve(file)}:/snapshot.dump:ro`],
  });

  console.log(`Fatto: ${describe(url, target)} ripristinato da ${path.basename(file)}.`);
  console.log('Se lo snapshot e\' piu\' vecchio delle migrazioni attuali, applicale con `prisma migrate deploy`.');
}

main().catch((error) => {
  console.error('[db-restore]', error instanceof Error ? error.message : error);
  process.exit(1);
});
