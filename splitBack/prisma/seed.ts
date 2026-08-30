import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Test users for the alpha. Idempotent: re-running upserts by email.
 * Disney nicknames double as easy-to-type logins (login is email-only).
 */
const users: { email: string; nickName: string }[] = [
  { email: 'd.micarelli7@gmail.com', nickName: 'Davide' },
  { email: 'pippo@disney.test', nickName: 'Pippo' },
  { email: 'pluto@disney.test', nickName: 'Pluto' },
  { email: 'paperino@disney.test', nickName: 'Paperino' },
  { email: 'topolino@disney.test', nickName: 'Topolino' },
  { email: 'minni@disney.test', nickName: 'Minni' },
  { email: 'paperone@disney.test', nickName: 'Paperone' },
  { email: 'qui@disney.test', nickName: 'Qui' },
  { email: 'quo@disney.test', nickName: 'Quo' },
  { email: 'qua@disney.test', nickName: 'Qua' },
  { email: 'gastone@disney.test', nickName: 'Gastone' },
  { email: 'archimede@disney.test', nickName: 'Archimede' },
  { email: 'nonnapapera@disney.test', nickName: 'NonnaPapera' },
  { email: 'amelia@disney.test', nickName: 'Amelia' },
];

async function main() {
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { nickName: u.nickName },
      create: { email: u.email, nickName: u.nickName, confirmed: true },
    });
    console.log(`✔ ${user.nickName.padEnd(12)} <${user.email}>  id=${user.id}`);
  }
  console.log(`\nDone: ${users.length} users upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
