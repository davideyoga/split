import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

// Come altrove, degli utenti si espongono solo publicId e nickName.
const USER_SELECT = { publicId: true, nickName: true } as const;

type Client = PrismaService | Prisma.TransactionClient;

/**
 * Amici (2026-10-25). Una spesa si crea direttamente solo con gli amici: con
 * chi non lo e' ancora la sua quota resta in attesa finche' non accetta, e
 * accettare vuol dire diventare amici (con tutte le altre spese in attesa
 * della stessa persona). Un invito in un gruppo accettato rende amici di tutti
 * i membri. Vedi CLAUDE.md, "Friends".
 *
 * Le richieste non hanno una tabella: sono le quote e gli inviti in attesa.
 * Rifiutare l'ultima fa sparire la richiesta, e la persona potra' riprovare.
 */
@Injectable()
export class FriendService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  /** Fra `candidateIds`, quelli amici di `userId`. */
  async friendIdsAmong(
    client: Client,
    userId: number,
    candidateIds: number[],
  ): Promise<Set<number>> {
    const others = candidateIds.filter((id) => id !== userId);
    if (others.length === 0) {
      return new Set();
    }
    const rows = await client.friendship.findMany({
      where: {
        OR: [
          { userAId: userId, userBId: { in: others } },
          { userBId: userId, userAId: { in: others } },
        ],
      },
      select: { userAId: true, userBId: true },
    });
    return new Set(
      rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId)),
    );
  }

  /**
   * Rende `userId` amico di ognuno di `otherIds` e sblocca le quote in attesa
   * fra loro, in entrambe le direzioni: "in attesa" vuol dire proprio "non
   * ancora amico di chi ti ha aggiunto". Gli inviti ai gruppi no: un gruppo si
   * accetta a parte.
   */
  async befriend(tx: Prisma.TransactionClient, userId: number, otherIds: number[]) {
    const others = [...new Set(otherIds)].filter((id) => id !== userId);
    if (others.length === 0) {
      return;
    }
    await tx.friendship.createMany({
      data: others.map((other) => orderedPair(userId, other)),
      skipDuplicates: true,
    });
    await tx.expenseContribution.updateMany({
      where: {
        pending: true,
        OR: [
          { userId, invitedById: { in: others } },
          { userId: { in: others }, invitedById: userId },
        ],
      },
      data: { pending: false },
    });
  }

  /** I miei amici, per nickname. */
  async list(userPublicId: string) {
    const user = await this.findUser(userPublicId);
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      select: {
        userAId: true,
        userA: { select: USER_SELECT },
        userB: { select: USER_SELECT },
      },
    });
    return rows
      .map((row) => (row.userAId === user.id ? row.userB : row.userA))
      .sort((a, b) => a.nickName.localeCompare(b.nickName));
  }

  /**
   * Le richieste ricevute: le spese in attesa raggruppate per chi mi ci ha
   * messo (si accettano tutte insieme, diventando amici), e gli inviti ai
   * gruppi (ognuno si accetta o rifiuta da solo).
   */
  async requests(userPublicId: string) {
    const user = await this.findUser(userPublicId);

    const contributions = await this.prisma.expenseContribution.findMany({
      where: { userId: user.id, pending: true, invitedById: { not: null } },
      orderBy: { createdDate: 'desc' },
      select: {
        share: true,
        invitedBy: { select: USER_SELECT },
        expense: {
          select: {
            publicId: true,
            description: true,
            amount: true,
            currency: true,
            date: true,
            category: { select: { slug: true } },
          },
        },
      },
    });

    const people = new Map<
      string,
      {
        user: { publicId: string; nickName: string };
        expenses: {
          publicId: string;
          description: string;
          amount: Prisma.Decimal;
          currency: string;
          date: Date;
          categorySlug: string | null;
          share: Prisma.Decimal;
        }[];
      }
    >();
    for (const contribution of contributions) {
      const inviter = contribution.invitedBy;
      if (!inviter) {
        continue;
      }
      const person = people.get(inviter.publicId) ?? { user: inviter, expenses: [] };
      person.expenses.push({
        publicId: contribution.expense.publicId,
        description: contribution.expense.description,
        amount: contribution.expense.amount,
        currency: contribution.expense.currency,
        date: contribution.expense.date,
        categorySlug: contribution.expense.category?.slug ?? null,
        share: contribution.share,
      });
      people.set(inviter.publicId, person);
    }

    const invitations = await this.prisma.userOnGroup.findMany({
      where: { userId: user.id, pending: true },
      orderBy: { createdDate: 'desc' },
      select: {
        invitedBy: { select: USER_SELECT },
        group: {
          select: {
            publicId: true,
            name: true,
            _count: { select: { usersOnGroup: { where: { pending: false } } } },
          },
        },
      },
    });

    return {
      people: [...people.values()],
      groups: invitations.map((invitation) => ({
        publicId: invitation.group.publicId,
        name: invitation.group.name,
        memberCount: invitation.group._count.usersOnGroup,
        invitedBy: invitation.invitedBy,
      })),
    };
  }

  /**
   * Accetta la richiesta di `requesterPublicId`: si diventa amici e tutte le
   * sue spese in attesa contano. Serve almeno una spesa in attesa da quella
   * persona: altrimenti chiunque potrebbe farsi amico di chiunque e poi
   * aggiungerlo alle spese senza conferma.
   */
  async accept(userPublicId: string, requesterPublicId: string) {
    const user = await this.findUser(userPublicId);
    const requester = await this.prisma.user.findUnique({
      where: { publicId: requesterPublicId },
      select: { id: true },
    });
    const pendingCount = requester
      ? await this.prisma.expenseContribution.count({
          where: { userId: user.id, invitedById: requester.id, pending: true },
        })
      : 0;
    if (!requester || pendingCount === 0) {
      throw new NotFoundException('Nessuna richiesta in attesa da questo utente');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.befriend(tx, user.id, [requester.id]);
      await this.notificationService.notify(tx, [requester.id], {
        type: 'FRIEND_ACCEPTED',
        actorId: user.id,
      });
    });
  }

  private async findUser(publicId: string) {
    const user = await this.prisma.user.findUnique({
      where: { publicId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    return user;
  }
}

// La coppia come la vuole il CHECK della tabella: prima l'id piu' basso.
function orderedPair(a: number, b: number) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}
