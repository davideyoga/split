/**
 * Aggiunge utenti veri (gli alpha tester) al database indicato da DATABASE_URL.
 * La registrazione e' disattivata (vedi CLAUDE.md, "Auth"), quindi e' cosi' che
 * si da' accesso a qualcuno: dopo questo script puo' fare login con la sua email.
 *
 * Gli utenti si leggono da un file JSON, di default splitBack/prisma/users.local.json,
 * che e' gitignored: le email degli amici non devono finire nel repository.
 * Formato: vedi users.example.json.
 *
 * Uso, dalla root del repo:
 *   DATABASE_URL='<stringa Neon>' node splitBack/prisma/add-users.mts [file.json]
 *
 * Non usa .env: il database va indicato ogni volta, cosi' e' chiaro se si sta
 * scrivendo su quello locale o su quello di produzione. Attenzione: importare
 * @prisma/client carica da solo il .env della root, quindi DATABASE_URL va
 * controllato PRIMA di importarlo (per questo l'import e' dinamico, in main()).
 * Idempotente: un'email
 * gia' presente non viene ricreata (se il nickname e' cambiato, lo aggiorna).
 * Non crea le categorie preset: quelle le crea seed.ts.
 *
 * `.mts` e non `.ts` per lo stesso motivo di splitFront-e2e/scripts/prepare-db.mts.
 */
import { readFileSync } from 'node:fs';

const DEFAULT_FILE = 'splitBack/prisma/users.local.json';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NewUser {
  email: string;
  nickName: string;
}

function readUsers(path: string): NewUser[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`Non riesco a leggere ${path}: ${(e as Error).message}\nCopia splitBack/prisma/users.example.json in ${DEFAULT_FILE} e mettici gli utenti.`);
  }
  if (!Array.isArray(raw)) {
    throw new Error(`${path} deve contenere una lista: [{ "email": "...", "nickName": "..." }, ...]`);
  }
  return raw.map((entry, i) => {
    const email = String(entry?.email ?? '').trim().toLowerCase();
    const nickName = String(entry?.nickName ?? '').trim();
    if (!EMAIL_RE.test(email)) {
      throw new Error(`Elemento ${i + 1}: email non valida "${entry?.email}"`);
    }
    if (!nickName) {
      throw new Error(`Elemento ${i + 1} (${email}): nickName mancante`);
    }
    return { email, nickName };
  });
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL non impostato: DATABASE_URL='<stringa>' node splitBack/prisma/add-users.mts");
  }
  const target = new URL(databaseUrl);
  const users = readUsers(process.argv[2] ?? DEFAULT_FILE);
  console.log(`Database: ${target.host}${target.pathname} — ${users.length} utenti\n`);

  const { PrismaClient, Prisma } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let failed = 0;
  try {
    for (const u of users) {
      try {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (!existing) {
          await prisma.user.create({ data: { email: u.email, nickName: u.nickName, confirmed: true } });
          console.log(`✔ creato      ${u.nickName.padEnd(14)} <${u.email}>`);
        } else if (existing.nickName !== u.nickName) {
          await prisma.user.update({ where: { id: existing.id }, data: { nickName: u.nickName } });
          console.log(`✔ aggiornato  ${u.nickName.padEnd(14)} <${u.email}> (era "${existing.nickName}")`);
        } else {
          console.log(`· gia' presente ${u.nickName.padEnd(12)} <${u.email}>`);
        }
      } catch (e) {
        failed++;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          console.error(`✘ ${u.email}: il nickname "${u.nickName}" e' gia' usato da un altro utente, scegline un altro`);
        } else {
          console.error(`✘ ${u.email}: ${(e as Error).message}`);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (failed > 0) {
    console.error(`\n${failed} utenti non aggiunti.`);
    process.exit(1);
  }
  console.log('\nFatto.');
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
