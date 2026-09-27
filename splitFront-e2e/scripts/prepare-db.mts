/**
 * Prepara il database dei test e2e. È il primo comando del webServer "api" in
 * playwright.config.ts, quindi gira a ogni esecuzione dei test, prima che
 * l'API e2e parta e si connetta:
 *   1. crea il database se non esiste;
 *   2. applica le migrazioni (`prisma migrate deploy`, non distruttivo);
 *   3. svuota tutte le tabelle tranne `_prisma_migrations`;
 *   4. esegue splitBack/prisma/seed.ts (categorie preconfigurate + utenti Disney).
 *
 * Legge DATABASE_URL, che playwright.config.ts imposta all'URL e2e. Il passo 3
 * cancella tutti i dati, quindi lo script si ferma se il nome del database non
 * finisce con "-e2e", e ricontrolla `current_database()` prima del TRUNCATE:
 * non deve mai poter toccare split-db.
 *
 * Si esegue con `node` (Node >= 22 rimuove i tipi TS), dalla root del workspace.
 * `.mts` e non `.ts`: il package non dichiara "type", e con `.ts` Node
 * dovrebbe indovinare che è un modulo ES (e lo segnalerebbe a ogni avvio).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const SCHEMA = 'splitBack/prisma/schema.prisma';
const SEED = 'splitBack/prisma/seed.ts';

function e2eDatabase(): { url: URL; name: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL non impostato: lancia i test con `npx nx e2e splitFront-e2e`.');
  }
  const url = new URL(raw);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name.endsWith('-e2e')) {
    throw new Error(`Rifiuto di svuotare "${name}": il database dei test e2e deve finire con "-e2e".`);
  }
  return { url, name };
}

async function createDatabaseIfMissing(url: URL, name: string): Promise<void> {
  // CREATE DATABASE va lanciato connessi a un altro database: quello di
  // manutenzione `postgres`, che esiste in ogni installazione.
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const prisma = new PrismaClient({ datasourceUrl: maintenance.toString() });
  try {
    const rows = await prisma.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (rows.length === 0) {
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
      console.log(`[prepare-db] creato il database ${name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function truncateAll(url: URL, name: string): Promise<void> {
  const prisma = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    const [{ current }] = await prisma.$queryRaw<{ current: string }[]>`SELECT current_database() AS current`;
    if (current !== name) {
      throw new Error(`Connesso a "${current}" invece di "${name}": TRUNCATE annullato.`);
    }
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length > 0) {
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }
    console.log(`[prepare-db] svuotate ${tables.length} tabelle di ${name}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  if (!existsSync(SCHEMA)) {
    throw new Error(`${SCHEMA} non trovato: lo script va lanciato dalla root del workspace.`);
  }
  const { url, name } = e2eDatabase();

  await createDatabaseIfMissing(url, name);
  execFileSync('npx', ['prisma', 'migrate', 'deploy', `--schema=${SCHEMA}`], { stdio: 'inherit' });
  await truncateAll(url, name);
  // seed.ts usa la sintassi ESM in un package senza "type": Node lo rilegge
  // come modulo ES e lo segnala a ogni esecuzione.
  execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SEED], {
    stdio: 'inherit',
  });
}

main().catch((error) => {
  console.error('[prepare-db]', error instanceof Error ? error.message : error);
  process.exit(1);
});
