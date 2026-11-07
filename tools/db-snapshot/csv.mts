/**
 * Estrae in CSV, una tabella per file, i dati di uno snapshot di
 * snapshot.mts. Lo snapshot crea gia' i suoi CSV: questo comando serve
 * quando la conversione era fallita, o per un dump che non ha la cartella csv/.
 * Non tocca nessun database. Dettagli in tools/db-snapshot/README.md.
 *
 * Uso, dalla root del repo:
 *   npm run db:csv -- db-snapshots/<snapshot>          # o il file .dump
 *
 * Scrive in csv/ accanto al file .dump, che non deve esistere gia'.
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { csvSummary, dumpToCsv, resolveDump } from './pg-tools.mts';

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    throw new Error('Uso: npm run db:csv -- db-snapshots/<snapshot>');
  }
  const dump = resolveDump(arg);
  const outDir = path.join(path.dirname(dump), 'csv');
  if (existsSync(outDir)) {
    throw new Error(`${outDir} esiste gia': cancellala per rigenerare i CSV.`);
  }
  try {
    const tables = await dumpToCsv(dump, outDir);
    console.log(`Fatto: ${outDir}/ (${csvSummary(tables)})`);
  } catch (error) {
    rmSync(outDir, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error('[db-csv]', error instanceof Error ? error.message : error);
  process.exit(1);
});
