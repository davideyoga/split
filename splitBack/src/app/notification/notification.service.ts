import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { blockersOf, withoutBlockers } from '../user/blocks';
import { ExpenseSnapshot, NotificationType } from './notification.types';

// Come per spese e rimborsi, degli utenti si espongono solo publicId e nickName.
const USER_SELECT = { publicId: true, nickName: true } as const;

const NOTIFICATION_SELECT = {
  publicId: true,
  type: true,
  createdDate: true,
  readAt: true,
  params: true,
  actor: { select: USER_SELECT },
  expense: {
    select: {
      publicId: true,
      description: true,
      amount: true,
      currency: true,
      category: { select: { slug: true } },
    },
  },
  group: { select: { publicId: true, name: true } },
  settlement: {
    select: {
      publicId: true,
      amount: true,
      currency: true,
      from: { select: USER_SELECT },
      to: { select: USER_SELECT },
    },
  },
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_SELECT;
}>;

// Quante se ne mostrano. Nessuna si cancella ancora (vedi TODO.md).
const LIST_LIMIT = 50;

export interface NewNotification {
  type: NotificationType;
  actorId: number;
  expenseId?: number;
  groupId?: number;
  settlementId?: number;
  params?: ExpenseSnapshot;
}

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Unico punto in cui nascono le notifiche, dentro la transazione
   * dell'azione che le causa: una spesa non esiste mai senza la sua notifica,
   * ne' il contrario. Chi ha fatto l'azione non riceve niente.
   *
   * Qui si aggancera' la push, dopo il commit della transazione (vedi
   * TODO.md): una push partita per una transazione poi annullata
   * annuncerebbe una spesa che non esiste.
   */
  async notify(
    tx: Prisma.TransactionClient,
    recipientIds: number[],
    notification: NewNotification,
  ) {
    const recipients = [...new Set(recipientIds)].filter(
      (id) => id !== notification.actorId,
    );
    // Chi ha bloccato chi agisce non riceve niente delle sue azioni.
    const userIds = withoutBlockers(
      recipients,
      await blockersOf(tx, notification.actorId, recipients),
    );
    if (userIds.length === 0) {
      return;
    }
    await tx.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: notification.type,
        actorId: notification.actorId,
        expenseId: notification.expenseId,
        groupId: notification.groupId,
        settlementId: notification.settlementId,
        params: notification.params,
      })),
    });
  }

  /**
   * Chi viene tolto da una spesa non deve piu' vederne descrizione e importo
   * nelle notifiche vecchie: si cancellano (al loro posto arriva
   * EXPENSE_REMOVED con l'istantanea).
   */
  async forgetExpense(
    tx: Prisma.TransactionClient,
    userIds: number[],
    expenseId: number,
  ) {
    if (userIds.length === 0) {
      return;
    }
    await tx.notification.deleteMany({
      where: { userId: { in: userIds }, expenseId },
    });
  }

  /** Come forgetExpense, per chi esce da un gruppo. */
  async forgetGroup(tx: Prisma.TransactionClient, userId: number, groupId: number) {
    await tx.notification.deleteMany({ where: { userId, groupId } });
  }

  async findMine(userPublicId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { user: { publicId: userPublicId } },
      orderBy: [{ createdDate: 'desc' }, { id: 'desc' }],
      take: LIST_LIMIT,
      select: NOTIFICATION_SELECT,
    });
    return rows.map((row) => this.toResponse(row));
  }

  async unreadCount(userPublicId: string) {
    const count = await this.prisma.notification.count({
      where: { user: { publicId: userPublicId }, readAt: null },
    });
    return { count };
  }

  /**
   * Segna come lette le notifiche indicate, solo fra quelle dell'utente: gli
   * id di un altro vengono ignorati. Restituisce quante ne restano da leggere.
   */
  async markRead(userPublicId: string, publicIds: string[]) {
    if (publicIds.length > 0) {
      await this.prisma.notification.updateMany({
        where: {
          user: { publicId: userPublicId },
          publicId: { in: publicIds },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }
    return this.unreadCount(userPublicId);
  }

  private toResponse(row: NotificationRow) {
    return {
      publicId: row.publicId,
      type: row.type,
      createdDate: row.createdDate,
      read: row.readAt !== null,
      actor: row.actor,
      expense: row.expense && {
        publicId: row.expense.publicId,
        description: row.expense.description,
        amount: row.expense.amount,
        currency: row.expense.currency,
        categorySlug: row.expense.category?.slug ?? null,
      },
      group: row.group,
      settlement: row.settlement,
      params: row.params,
    };
  }
}
