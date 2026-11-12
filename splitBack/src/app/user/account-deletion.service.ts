import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DELETED_NICKNAME_PREFIX } from './nickname';

// Una quindicina di query, col DB in un'altra regione: il timeout di default
// delle transazioni interattive (5 s) sarebbe stretto.
const DELETION_TRANSACTION_TIMEOUT_MS = 20_000;

const IS_DELETED = { deletedAt: { not: null } };

/**
 * I campi che identificano una persona, sostituiti da valori casuali e tutti
 * diversi fra loro (non si risale da uno all'altro). Il nickname ha un prefisso
 * che le regole vietano: nessuno puo' spacciarsi per un utente eliminato, e il
 * frontend lo riconosce e lo traduce (nel DB non si salva testo generato).
 * `.invalid` e' un dominio riservato: nessuna email potra' mai arrivarci.
 */
export function anonymizedIdentity(now: Date) {
  return {
    email: `${randomUUID()}@deleted.invalid`,
    nickName: `${DELETED_NICKNAME_PREFIX}${randomUUID()}`,
    publicId: randomUUID(),
    image: null,
    confirmed: false,
    needsName: false,
    deletedAt: now,
  };
}

/**
 * Cancellazione dell'account dal Profilo (2026-11-08; regole promesse agli
 * utenti in doc/privacy/). La riga User resta, svuotata: spese e rimborsi degli
 * altri la referenziano e i loro saldi si calcolano da li'. Tutto o niente, in
 * una transazione.
 */
@Injectable()
export class AccountDeletionService {
  constructor(private prisma: PrismaService) {}

  async deleteAccount(userPublicId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const me = await tx.user.findUnique({
          where: { publicId: userPublicId },
          select: { id: true, email: true },
        });
        if (!me) {
          throw new NotFoundException('Utente non trovato');
        }
        const now = new Date();

        // Esce dai gruppi, e i link che aveva creato smettono di valere.
        const memberships = await tx.userOnGroup.findMany({
          where: { userId: me.id },
          select: { groupId: true },
        });
        const myGroupIds = memberships.map((m) => m.groupId);
        await tx.groupInvite.updateMany({
          where: { createdById: me.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.userOnGroup.deleteMany({ where: { userId: me.id } });

        // Quello che serve solo a questa persona. Le righe di Verification
        // hanno l'email in chiaro nell'identificatore: `<tipo>-otp-<email>`.
        await tx.session.deleteMany({ where: { userId: me.id } });
        await tx.account.deleteMany({ where: { userId: me.id } });
        await tx.verification.deleteMany({
          where: { identifier: { endsWith: `-otp-${me.email}` } },
        });
        await tx.userBlock.deleteMany({
          where: { OR: [{ blockerId: me.id }, { blockedId: me.id }] },
        });
        await tx.notification.deleteMany({ where: { userId: me.id } });
        // La riga User resta, quindi la cascata non scatta: i browser iscritti
        // alle push vanno tolti a mano.
        await tx.pushDevice.deleteMany({ where: { userId: me.id } });

        // Le descrizioni delle spese condivise restano (decisione dell'utente,
        // e lo dice l'informativa); le note dei rimborsi non servono ai saldi.
        await tx.settlement.updateMany({
          where: { createdById: me.id, note: { not: null } },
          data: { note: null },
        });

        // Le categorie custom se ne vanno anche dalle spese condivise. Mai
        // `ownerId: null` al posto della cancellazione: diventerebbero preset
        // visibili a tutti.
        const myCategories = await tx.category.findMany({
          where: { ownerId: me.id },
          select: { id: true },
        });
        const myCategoryIds = myCategories.map((c) => c.id);
        await tx.expense.updateMany({
          where: { categoryId: { in: myCategoryIds } },
          data: { categoryId: null },
        });
        await tx.category.deleteMany({ where: { id: { in: myCategoryIds } } });

        await tx.user.update({
          where: { id: me.id },
          data: anonymizedIdentity(now),
        });

        // Da qui in poi conta `deletedAt`, appena scritto. Una spesa che non
        // serve piu' a nessuno sparisce: quelle solo mie e quelle rimaste fra
        // soli utenti eliminati, purche' nessun membro di un gruppo le veda.
        const orphans = await tx.expense.findMany({
          where: {
            expenseContributions: { some: {}, every: { user: IS_DELETED } },
            OR: [{ groupId: null }, { group: { usersOnGroup: { none: {} } } }],
          },
          select: { id: true },
        });
        const orphanIds = orphans.map((e) => e.id);
        await tx.expenseContribution.deleteMany({ where: { expenseId: { in: orphanIds } } });
        await tx.expense.deleteMany({ where: { id: { in: orphanIds } } });
        await tx.settlement.deleteMany({
          where: { from: IS_DELETED, to: IS_DELETED },
        });

        // Un gruppo rimasto senza membri non lo apre piu' nessuno. Le sue spese
        // ancora vive (un partecipante aggiunto a mano, non membro) restano
        // come spese senza gruppo: i saldi non cambiano.
        const emptied = await tx.group.findMany({
          where: { id: { in: myGroupIds }, usersOnGroup: { none: {} } },
          select: { id: true },
        });
        const emptiedIds = emptied.map((g) => g.id);
        await tx.expense.updateMany({
          where: { groupId: { in: emptiedIds } },
          data: { groupId: null },
        });
        await tx.group.deleteMany({ where: { id: { in: emptiedIds } } });
      },
      { timeout: DELETION_TRANSACTION_TIMEOUT_MS },
    );
  }
}
