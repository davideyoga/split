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

/**
 * Categorie preconfigurate (ownerId null = visibili a tutti gli utenti).
 * Il nome mostrato NON sta in DB: il frontend traduce `categories.<slug>` da
 * en.json / it.json. Idempotente: upsert per slug.
 */
const categories: { slug: string; icon: string }[] = [
  { slug: 'food', icon: 'fast-food-outline' },
  { slug: 'restaurant', icon: 'restaurant-outline' },
  { slug: 'groceries', icon: 'cart-outline' },
  { slug: 'transport', icon: 'bus-outline' },
  { slug: 'fuel', icon: 'car-outline' },
  { slug: 'accommodation', icon: 'bed-outline' },
  { slug: 'activities', icon: 'ticket-outline' },
  { slug: 'shopping', icon: 'bag-handle-outline' },
  { slug: 'health', icon: 'medkit-outline' },
  { slug: 'other', icon: 'pricetag-outline' },
];

async function main() {
  for (const c of categories) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { icon: c.icon, archived: false },
      create: { slug: c.slug, icon: c.icon },
    });
    console.log(`✔ ${category.slug?.padEnd(14)} icon=${category.icon}`);
  }
  console.log(`\nDone: ${categories.length} categories upserted.\n`);

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
