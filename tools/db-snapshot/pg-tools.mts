/**
 * Pezzi comuni a snapshot.mts, restore.mts e csv.mts (vedi README.md).
 *
 * pg_dump e pg_restore non sono installati su questa macchina: girano
 * nell'immagine Docker ufficiale `postgres:<N>-alpine`, con N = versione
 * principale del server. pg_dump si rifiuta di leggere un server piu' nuovo di
 * lui, e il DB di sviluppo (container split-db, Postgres 15) e Neon non hanno
 * per forza la stessa versione.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, type WriteStream } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import type { PrismaClient } from '@prisma/client';

/**
 * La stringa di connessione nella variabile `name`: dall'ambiente se c'e',
 * altrimenti da `.env` (che non sovrascrive le variabili gia' impostate).
 */
export function urlFromEnv(name: string, hint: string): URL {
  if (!process.env[name] && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`${name} non impostato, ne' nell'ambiente ne' in .env. ${hint}`);
  }
  return new URL(raw);
}

export function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.slice(1));
}

/** `admin@localhost:5432/split-db`, senza password: da stampare. */
export function describe(url: URL, database = databaseName(url)): string {
  return `${decodeURIComponent(url.username)}@${url.host}/${database}`;
}

// Parametri della stringa di connessione che libpq capisce. Gli altri
// (`schema`, `connection_limit`, `pgbouncer`, ...) sono solo di Prisma, e
// libpq li rifiuterebbe ("invalid URI query parameter").
const LIBPQ_PARAMS: Record<string, string> = {
  sslmode: 'PGSSLMODE',
  channel_binding: 'PGCHANNELBINDING',
  connect_timeout: 'PGCONNECT_TIMEOUT',
  options: 'PGOPTIONS',
};

/** La connessione come variabili d'ambiente PG* di libpq. */
export function libpqEnv(url: URL, database = databaseName(url)): Record<string, string> {
  const env: Record<string, string> = {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
  };
  for (const [param, name] of Object.entries(LIBPQ_PARAMS)) {
    const value = url.searchParams.get(param);
    if (value !== null) {
      env[name] = value;
    }
  }
  return env;
}

/**
 * Apre un PrismaClient su `url`. L'import e' dinamico, come in
 * splitBack/prisma/add-users.mts: importare @prisma/client carica `.env` da
 * solo, e qui DATABASE_URL e' gia' stato letto.
 */
export async function withPrisma<T>(url: URL, work: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    return await work(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/** Versione principale del server: 15, 17, ... */
export async function serverMajor(prisma: PrismaClient): Promise<number> {
  const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`
    SELECT current_setting('server_version_num') AS version`;
  return Math.floor(Number(version) / 10000);
}

/** Il file .dump indicato: quello passato, o l'unico .dump nella cartella di uno snapshot. */
export function resolveDump(arg: string): string {
  if (!existsSync(arg)) {
    throw new Error(`${arg} non trovato.`);
  }
  if (!statSync(arg).isDirectory()) {
    return arg;
  }
  const dumps = readdirSync(arg).filter((name) => name.endsWith('.dump'));
  if (dumps.length !== 1) {
    throw new Error(`${arg}: dentro ci deve essere un solo file .dump, ne ho trovati ${dumps.length}.`);
  }
  return path.join(arg, dumps[0]);
}

/** La versione del server che snapshot.mts scrive nel nome del file (`..._pg17.dump`). */
export function dumpMajor(file: string): number | undefined {
  const match = /_pg(\d+)\.dump$/.exec(file);
  return match ? Number(match[1]) : undefined;
}

/**
 * Lancia un programma di Postgres (pg_dump, pg_restore, psql) nell'immagine
 * `postgres:<major>-alpine`, scaricata da Docker la prima volta.
 * `--network host`: dentro il container `localhost` e' questa macchina.
 * Le variabili vanno passate come `-e NOME` senza valore, cosi' la password
 * non compare negli argomenti del processo (`ps`).
 * `stdout`: un file gia' aperto, oppure una funzione che legge l'output.
 */
export async function runPgTool(
  major: number,
  env: Record<string, string>,
  args: string[],
  options: { stdout?: number | ((out: Readable) => Promise<void>); mounts?: string[] } = {},
): Promise<void> {
  const dockerArgs = ['run', '--rm', '--network', 'host'];
  for (const name of Object.keys(env)) {
    dockerArgs.push('-e', name);
  }
  for (const mount of options.mounts ?? []) {
    dockerArgs.push('-v', mount);
  }
  dockerArgs.push(`postgres:${major}-alpine`, ...args);

  const { stdout } = options;
  const child = spawn('docker', dockerArgs, {
    env: { ...process.env, ...env },
    stdio: ['ignore', typeof stdout === 'function' ? 'pipe' : (stdout ?? 'inherit'), 'inherit'],
  });
  const exited = new Promise<void>((resolve, reject) => {
    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'ENOENT' ? new Error('docker non trovato: serve Docker per pg_dump/pg_restore.') : error);
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`postgres:${major}-alpine e' uscito con codice ${code}: l'errore e' sopra.`));
      }
    });
  });
  if (typeof stdout !== 'function' || !child.stdout) {
    return exited;
  }
  const consumed = stdout(child.stdout).catch((error: unknown) => {
    child.kill();
    throw error;
  });
  await Promise.all([exited, consumed]);
}

// --- Da dump a CSV -----------------------------------------------------------

// `COPY public."User" (id, "publicId", ...) FROM stdin;`
const COPY_LINE = /^COPY (.+?) \((.*)\) FROM stdin;$/;
const NAME_PART = /"(?:[^"]|"")*"|[^."]+/g;
const COLUMN = /"(?:[^"]|"")*"|[^,\s]+/g;
const COPY_ESCAPE = /\\(?:([0-7]{1,3})|x([0-9A-Fa-f]{1,2})|(.))/g;
const COPY_ESCAPES: Record<string, string> = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };

function unquoteIdent(ident: string): string {
  return ident.startsWith('"') ? ident.slice(1, -1).replaceAll('""', '"') : ident;
}

/** Un valore del formato testo di COPY: `\N` e' NULL, il resto ha escape con `\`. */
function copyValue(raw: string): string | null {
  if (raw === '\\N') {
    return null;
  }
  return raw.replace(COPY_ESCAPE, (_, octal: string, hex: string, char: string) => {
    if (octal) {
      return String.fromCharCode(parseInt(octal, 8));
    }
    if (hex) {
      return String.fromCharCode(parseInt(hex, 16));
    }
    return COPY_ESCAPES[char] ?? char;
  });
}

function csvQuote(value: string): string {
  return value === '' || /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Un campo CSV come lo scrive `COPY ... CSV` di Postgres: NULL e' un campo
 * vuoto, la stringa vuota e' `""`. In piu', un testo che inizia con = + - @
 * (non un numero) prende un `'` davanti: aperto in Excel/LibreOffice sarebbe
 * eseguito come formula, e descrizioni e note le scrivono gli utenti.
 */
function csvField(raw: string): string {
  const value = copyValue(raw);
  if (value === null) {
    return '';
  }
  const formula = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value);
  return csvQuote(formula ? `'${value}` : value);
}

/**
 * Scrive i dati di un dump in CSV, un file per tabella, nella cartella
 * `outDir` (creata qui, non deve esistere). Non serve un database:
 * `pg_restore --data-only` stampa i blocchi `COPY ... FROM stdin` del dump,
 * convertiti riga per riga. Le tabelle senza dati nel dump (Session,
 * Verification) non hanno un file.
 */
export async function dumpToCsv(file: string, outDir: string): Promise<{ table: string; rows: number }[]> {
  const major = dumpMajor(file);
  if (major === undefined) {
    throw new Error(`${path.basename(file)}: il nome non dice la versione di Postgres (manca "_pgN.dump").`);
  }
  mkdirSync(outDir, { mode: 0o700 });
  const tables: { table: string; rows: number }[] = [];

  const convert = async (out: Readable) => {
    let csv: WriteStream | undefined;
    let current = { table: '', rows: 0 };
    for await (const line of createInterface({ input: out, crlfDelay: Infinity })) {
      if (!csv) {
        const copy = COPY_LINE.exec(line);
        if (copy) {
          const [schema, table] = (copy[1].match(NAME_PART) ?? []).map(unquoteIdent);
          const name = table === undefined ? schema : schema === 'public' ? table : `${schema}.${table}`;
          const columns = (copy[2].match(COLUMN) ?? []).map(unquoteIdent);
          current = { table: name, rows: 0 };
          tables.push(current);
          csv = createWriteStream(path.join(outDir, `${name.replace(/[^\w.-]/g, '_')}.csv`), {
            flags: 'wx',
            mode: 0o600,
          });
          csv.write(columns.map(csvQuote).join(',') + '\n');
        }
        continue;
      }
      if (line === '\\.') {
        csv.end();
        await finished(csv);
        csv = undefined;
        continue;
      }
      current.rows++;
      if (!csv.write(line.split('\t').map(csvField).join(',') + '\n')) {
        await once(csv, 'drain');
      }
    }
  };

  await runPgTool(major, {}, ['pg_restore', '--data-only', '--file=-', '/snapshot.dump'], {
    mounts: [`${path.resolve(file)}:/snapshot.dump:ro`],
    stdout: convert,
  });
  return tables;
}

/** `11 tabelle, 107 righe`. */
export function csvSummary(tables: { rows: number }[]): string {
  const rows = tables.reduce((sum, t) => sum + t.rows, 0);
  return `${tables.length} tabelle, ${rows} righe`;
}
