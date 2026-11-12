/**
 * Snapshot del database di produzione (Neon): una copia completa sul PC, da
 * lanciare a mano quando serve, per esempio prima di un deploy con una
 * migrazione. Dettagli in tools/db-snapshot/README.md.
 *
 * Uso, dalla root del repo:
 *   npm run db:snapshot                          # il DB di SNAPSHOT_DATABASE_URL
 *   npm run db:snapshot -- prima-della-migrazione  # con un'etichetta nel nome
 *
 * Legge SNAPSHOT_DATABASE_URL dall'ambiente o da `.env`: la stringa di
 * connessione di Neon. Non e' DATABASE_URL, cosi' il backend di sviluppo non
 * finisce mai collegato alla produzione. Per fotografare un altro database:
 *   SNAPSHOT_DATABASE_URL='<stringa>' npm run db:snapshot
 *
 * Crea la cartella db-snapshots/<db>_<host>_<data>_<ora>[_<etichetta>]_pg<N>/ con:
 *   - <stesso nome>.dump: il dump nel formato "custom" di pg_dump (compresso),
 *     da ripristinare con restore.mts. N e' la versione di Postgres del
 *     server, che serve per scegliere pg_restore;
 *   - csv/<tabella>.csv: i dati dello stesso dump, una tabella per file.
 * Sola lettura sul database, che viene letto una volta sola: i CSV si
 * ricavano dal dump.
 */
import { closeSync, mkdirSync, openSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  csvSummary,
  databaseName,
  describe,
  dumpToCsv,
  libpqEnv,
  runPgTool,
  serverMajor,
  urlFromEnv,
  withPrisma,
} from './pg-tools.mts';

const OUT_DIR = 'db-snapshots';

// Tabelle di cui si salva lo schema ma non i dati. Session contiene i token
// delle sessioni in chiaro: con uno di quelli si entra come quell'utente per
// 30 giorni, quindi non devono finire in una copia sul PC. Verification ha
// solo codici di login che scadono in 10 minuti. Dopo un ripristino tutti
// rifanno il login. PushDevice ha endpoint e chiavi delle push di ogni browser:
// dopo un ripristino si riattivano dal Profilo.
const SKIP_DATA = ['"Session"', '"Verification"', '"PushDevice"'];

/** `2026-11-07_153012`, ora locale. */
function timestamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${day}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main(): Promise<void> {
  const label = process.argv[2];
  if (label !== undefined && !/^[A-Za-z0-9.-]{1,40}$/.test(label)) {
    throw new Error("L'etichetta puo' avere solo lettere, numeri, '.' e '-' (max 40 caratteri).");
  }

  const url = urlFromEnv(
    'SNAPSHOT_DATABASE_URL',
    'Aggiungi a .env la stringa di connessione di Neon (vedi .env.example).',
  );
  // Neon: pg_dump va fatto sulla connessione diretta. Quella del pooler
  // (PgBouncer in transaction mode, "-pooler" nell'host) non e' adatta.
  if (url.hostname.includes('-pooler.')) {
    url.hostname = url.hostname.replace('-pooler.', '.');
    console.log('Uso la connessione diretta di Neon al posto di quella del pooler.');
  }
  console.log(`Snapshot di ${describe(url)}`);

  const major = await withPrisma(url, serverMajor);
  const host = url.hostname.split('.')[0].replace(/[^A-Za-z0-9-]/g, '-');
  const name = [databaseName(url), host, timestamp(), label, `pg${major}`].filter(Boolean).join('_');
  const dir = path.join(OUT_DIR, name);

  // Contiene email e dati veri: cartelle e file leggibili solo da te.
  // Tutto si scrive in una cartella .partial, rinominata solo alla fine: uno
  // snapshot interrotto non deve sembrare valido.
  mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });
  const partial = `${dir}.partial`;
  mkdirSync(partial, { mode: 0o700 });
  const dump = path.join(partial, `${name}.dump`);
  try {
    const fd = openSync(dump, 'wx', 0o600);
    try {
      await runPgTool(
        major,
        libpqEnv(url),
        ['pg_dump', '--format=custom', ...SKIP_DATA.map((table) => `--exclude-table-data=${table}`)],
        { stdout: fd },
      );
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    rmSync(partial, { recursive: true, force: true });
    throw error;
  }

  // Se la conversione in CSV fallisce, il dump resta comunque valido.
  let csv: string;
  try {
    csv = `csv/ (${csvSummary(await dumpToCsv(dump, path.join(partial, 'csv')))})`;
  } catch (error) {
    rmSync(path.join(partial, 'csv'), { recursive: true, force: true });
    csv = `CSV NON creati (${error instanceof Error ? error.message : error}): riprova con npm run db:csv -- ${dir}`;
  }
  renameSync(partial, dir);

  const kb = Math.ceil(statSync(path.join(dir, `${name}.dump`)).size / 1024);
  console.log(`Fatto: ${dir}/`);
  console.log(`  ${name}.dump (${kb} KB)`);
  console.log(`  ${csv}`);
}

main().catch((error) => {
  console.error('[db-snapshot]', error instanceof Error ? error.message : error);
  process.exit(1);
});
