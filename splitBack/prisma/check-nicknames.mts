/**
 * Controlla i nickname gia' nel database indicato da DATABASE_URL. Sola
 * lettura: non modifica niente.
 *
 * Segnala:
 *   - i nickname che non rispettano le regole di splitBack/src/app/user/nickname.ts
 *     (da 5 a 20 caratteri, solo lettere senza accenti, numeri, "." e "-");
 *   - i nickname che differiscono solo per le maiuscole: con loro nel DB la
 *     migrazione 20260928120000_nickname_citext fallisce.
 *
 * Uso, dalla root del repo, PRIMA di fare il deploy di quella migrazione:
 *   DATABASE_URL='<stringa Neon>' node splitBack/prisma/check-nicknames.mts
 *
 * Come add-users.mts non usa .env (importare @prisma/client lo caricherebbe da
 * solo, per questo l'import e' dinamico): il database va indicato ogni volta.
 * Esce con codice 1 se trova qualcosa da correggere.
 */
import { nicknameError } from '../src/app/user/nickname.ts';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL non impostato: DATABASE_URL='<stringa>' node splitBack/prisma/check-nicknames.mts");
  }
  const target = new URL(databaseUrl);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  let users: { nickName: string; email: string }[];
  try {
    users = await prisma.user.findMany({ select: { nickName: true, email: true }, orderBy: { id: 'asc' } });
  } finally {
    await prisma.$disconnect();
  }
  console.log(`Database: ${target.host}${target.pathname} — ${users.length} utenti\n`);

  const invalid = users
    .map((u) => ({ ...u, error: nicknameError(u.nickName) }))
    .filter((u) => u.error !== null);
  for (const u of invalid) {
    console.log(`✘ ${JSON.stringify(u.nickName).padEnd(22)} <${u.email}>  ${u.error}`);
  }

  const byLower = new Map<string, typeof users>();
  for (const u of users) {
    const key = u.nickName.toLowerCase();
    byLower.set(key, [...(byLower.get(key) ?? []), u]);
  }
  const clashes = [...byLower.values()].filter((group) => group.length > 1);
  for (const group of clashes) {
    console.log(`✘ stesso nickname a meno delle maiuscole: ${group.map((u) => `"${u.nickName}" <${u.email}>`).join(', ')}`);
  }

  if (invalid.length > 0 || clashes.length > 0) {
    console.log(
      '\nDa correggere: cambia i nickname nel DB (o chiedi agli utenti di farlo dal Profilo).',
    );
    process.exit(1);
  }
  console.log('Tutti i nickname rispettano le regole.');
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
