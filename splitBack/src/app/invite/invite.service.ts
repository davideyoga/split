import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { GroupService } from '../group/group.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  inviteStatus,
  type InviteExpiryDays,
} from './invite-token';

const USER_SELECT = { publicId: true, nickName: true } as const;

/**
 * Link d'invito ai gruppi (2026-11-07, doc/InvitiGruppo.md): nei gruppi si
 * entra solo cosi'. Il gruppo si ricava sempre dal token, mai da un parametro
 * del client. Errori con un `code` (INVITE_*) che il frontend traduce.
 */
@Injectable()
export class InviteService {
  constructor(
    private prisma: PrismaService,
    private groupService: GroupService,
    private notificationService: NotificationService,
  ) {}

  // Il link attivo del gruppo, senza token: il token si vede solo alla
  // creazione, per ricondividerlo serve un link nuovo.
  async active(userPublicId: string, groupPublicId: string) {
    const { group } = await this.groupService.memberOf(userPublicId, groupPublicId);
    const invite = await this.prisma.groupInvite.findFirst({
      where: { groupId: group.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdDate: 'desc' },
      select: { expiresAt: true, createdDate: true, createdBy: { select: USER_SELECT } },
    });
    return { invite };
  }

  // Un solo link attivo per gruppo (decisione dell'utente): crearne uno
  // revoca i precedenti, che restano per l'audit. Qualsiasi membro puo' farlo
  // (come per il resto del gruppo, vedi il TODO in GroupService).
  async create(userPublicId: string, groupPublicId: string, days: InviteExpiryDays) {
    const { group, userId } = await this.groupService.memberOf(userPublicId, groupPublicId);
    const now = new Date();
    const { token, tokenHash } = generateInviteToken();
    const expiresAt = inviteExpiry(now, days);

    await this.prisma.$transaction([
      this.prisma.groupInvite.updateMany({
        where: { groupId: group.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.groupInvite.create({
        data: { groupId: group.id, tokenHash, createdById: userId, expiresAt },
      }),
    ]);
    return { token, expiresAt };
  }

  async revoke(userPublicId: string, groupPublicId: string) {
    const { group } = await this.groupService.memberOf(userPublicId, groupPublicId);
    await this.prisma.groupInvite.updateMany({
      where: { groupId: group.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Anteprima pubblica: nome del gruppo, chi invita, quanti membri, scadenza.
   * Niente nomi dei membri ne' spese. A chi e' gia' membro (con una sessione)
   * dice anche il gruppo, cosi' la pagina lo porta li' invece di "Unisciti".
   */
  async preview(token: string, callerPublicId?: string) {
    const invite = await this.findUsable(token);
    const alreadyMember =
      !!callerPublicId &&
      invite.group.usersOnGroup.some((link) => link.user.publicId === callerPublicId);
    return {
      groupName: invite.group.name,
      invitedBy: invite.createdBy.nickName,
      memberCount: invite.group.usersOnGroup.length,
      expiresAt: invite.expiresAt,
      alreadyMember,
      groupPublicId: alreadyMember ? invite.group.publicId : null,
    };
  }

  /**
   * Entra nel gruppo. Idempotente: chi e' gia' membro riceve lo stesso il
   * gruppo, senza notifiche. Chi entra lo sanno tutti i membri (GROUP_JOINED):
   * vede tutto lo storico, quindi chi non lo conosce deve poterlo togliere.
   */
  async join(userPublicId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { publicId: userPublicId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    const invite = await this.findUsable(token);
    const group = invite.group;
    const memberIds = group.usersOnGroup.map((link) => link.userId);
    if (memberIds.includes(user.id)) {
      return { groupPublicId: group.publicId, joined: false };
    }

    const joined = await this.prisma.$transaction(async (tx) => {
      // skipDuplicates: due "Unisciti" quasi simultanei non fanno un 500.
      const { count } = await tx.userOnGroup.createMany({
        data: [{ groupId: group.id, userId: user.id, inviteId: invite.id }],
        skipDuplicates: true,
      });
      if (count > 0) {
        await this.notificationService.notify(tx, memberIds, {
          type: 'GROUP_JOINED',
          actorId: user.id,
          groupId: group.id,
        });
      }
      return count > 0;
    });
    return { groupPublicId: group.publicId, joined };
  }

  private async findUsable(token: string) {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: {
        createdBy: { select: USER_SELECT },
        group: {
          select: {
            id: true,
            publicId: true,
            name: true,
            usersOnGroup: { select: { userId: true, user: { select: { publicId: true } } } },
          },
        },
      },
    });
    if (!invite) {
      throw new NotFoundException({ statusCode: 404, code: 'INVITE_NOT_FOUND', message: 'INVITE_NOT_FOUND' });
    }
    const status = inviteStatus(invite, new Date());
    if (status !== 'ACTIVE') {
      const code = `INVITE_${status}`;
      throw new GoneException({ statusCode: 410, code, message: code });
    }
    return invite;
  }
}
