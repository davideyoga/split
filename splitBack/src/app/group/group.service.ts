import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FriendService } from '../friend/friend.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupMembersDto } from './dto/group-members.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

// Ogni risposta espone i membri come utenti "leggeri" (publicId + nickName),
// come fa UserService.getUser per la ricerca. Le righe con `pending` sono
// inviti non ancora accettati (2026-10-25): escono a parte, come `invited`.
const MEMBERS_INCLUDE = {
  usersOnGroup: {
    include: { user: { select: { publicId: true, nickName: true } } },
  },
} satisfies Prisma.GroupInclude;

type GroupWithMembers = Prisma.GroupGetPayload<{
  include: typeof MEMBERS_INCLUDE;
}>;

@Injectable()
export class GroupService {
  // TODO before beta: qualsiasi membro puo' rinominare il gruppo e aggiungere/
  // rimuovere membri. Aggiungere Group.createdById (owner) e limitare le
  // mutazioni all'owner.
  constructor(
    private prisma: PrismaService,
    private friendService: FriendService,
    private notificationService: NotificationService,
  ) {}

  async create(creatorPublicId: string, dto: CreateGroupDto) {
    const creator = await this.prisma.user.findUnique({
      where: { publicId: creatorPublicId },
    });
    if (!creator) {
      throw new NotFoundException('Creatore non trovato');
    }

    const members = await this.resolveMembers(dto.memberPublicIds);

    // Il creatore fa sempre parte del gruppo, anche se non elencato nei membri.
    // Gli amici del creatore entrano subito, gli altri sono invitati.
    const otherIds = [...new Set(members.map((m) => m.id))].filter(
      (id) => id !== creator.id,
    );
    const friends = await this.friendService.friendIdsAmong(
      this.prisma,
      creator.id,
      otherIds,
    );
    const invitedIds = otherIds.filter((id) => !friends.has(id));

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: dto.name,
          usersOnGroup: {
            create: [creator.id, ...otherIds].map((userId) =>
              invitedIds.includes(userId)
                ? {
                    user: { connect: { id: userId } },
                    pending: true,
                    invitedBy: { connect: { id: creator.id } },
                  }
                : { user: { connect: { id: userId } } },
            ),
          },
        },
        include: MEMBERS_INCLUDE,
      });
      await this.notifyAdded(tx, creator.id, created.id, otherIds, invitedIds);
      return created;
    });

    return this.toResponse(group);
  }

  async findMine(userPublicId: string) {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
    });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    const groups = await this.prisma.group.findMany({
      where: { usersOnGroup: { some: { userId: user.id, pending: false } } },
      orderBy: { createdDate: 'desc' },
      include: MEMBERS_INCLUDE,
    });

    return groups.map((group) => this.toResponse(group));
  }

  async findOne(userPublicId: string, groupPublicId: string) {
    const group = await this.assertMember(userPublicId, groupPublicId);
    return this.toResponse(group);
  }

  async rename(
    userPublicId: string,
    groupPublicId: string,
    dto: UpdateGroupDto,
  ) {
    const group = await this.assertMember(userPublicId, groupPublicId);

    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: { name: dto.name },
      include: MEMBERS_INCLUDE,
    });

    return this.toResponse(updated);
  }

  async addMembers(
    userPublicId: string,
    groupPublicId: string,
    dto: GroupMembersDto,
  ) {
    const group = await this.assertMember(userPublicId, groupPublicId);
    const members = await this.resolveMembers(dto.memberPublicIds);

    // Chi aggiunge e' un membro (assertMember); chi c'era gia' (anche solo
    // invitato) non va notificato, e createMany con skipDuplicates non dice
    // chi ha inserito.
    const currentIds = group.usersOnGroup.map((link) => link.userId);
    const actorId = group.usersOnGroup.find(
      (link) => link.user.publicId === userPublicId,
    )?.userId;
    if (actorId === undefined) {
      throw new ForbiddenException('Non fai parte di questo gruppo');
    }
    const newIds = members
      .map((member) => member.id)
      .filter((id) => !currentIds.includes(id));
    // Gli amici di chi aggiunge entrano subito, gli altri sono invitati.
    const friends = await this.friendService.friendIdsAmong(this.prisma, actorId, newIds);
    const invitedIds = newIds.filter((id) => !friends.has(id));

    await this.prisma.$transaction(async (tx) => {
      // Idempotente grazie a @@unique([groupId, userId]) su UserOnGroup.
      await tx.userOnGroup.createMany({
        data: newIds.map((userId) =>
          invitedIds.includes(userId)
            ? { groupId: group.id, userId, pending: true, invitedById: actorId }
            : { groupId: group.id, userId },
        ),
        skipDuplicates: true,
      });
      await this.notifyAdded(tx, actorId, group.id, newIds, invitedIds);
    });

    return this.findOne(userPublicId, groupPublicId);
  }

  /**
   * Accetta l'invito: si diventa membri e amici di tutti i membri
   * (decisione dell'utente, 2026-10-25), quindi anche le spese in attesa fra
   * te e loro contano da ora.
   */
  async accept(userPublicId: string, groupPublicId: string) {
    const { user, group, invitation } = await this.findInvitation(
      userPublicId,
      groupPublicId,
    );
    const memberIds = group.usersOnGroup
      .filter((link) => !link.pending)
      .map((link) => link.userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userOnGroup.update({
        where: { id: invitation.id },
        data: { pending: false },
      });
      await this.friendService.befriend(tx, user.id, memberIds);
      if (invitation.invitedById) {
        await this.notificationService.notify(tx, [invitation.invitedById], {
          type: 'GROUP_JOINED',
          actorId: user.id,
          groupId: group.id,
        });
      }
    });

    return this.findOne(userPublicId, groupPublicId);
  }

  // Rifiuta l'invito: la riga sparisce e chi ha invitato lo sa.
  async decline(userPublicId: string, groupPublicId: string) {
    const { user, group, invitation } = await this.findInvitation(
      userPublicId,
      groupPublicId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.userOnGroup.delete({ where: { id: invitation.id } });
      await this.notificationService.forgetGroup(tx, user.id, group.id);
      if (invitation.invitedById) {
        await this.notificationService.notify(tx, [invitation.invitedById], {
          type: 'GROUP_DECLINED',
          actorId: user.id,
          groupId: group.id,
        });
      }
    });
  }

  async removeMember(
    userPublicId: string,
    groupPublicId: string,
    targetPublicId: string,
  ) {
    const group = await this.assertMember(userPublicId, groupPublicId);

    const target = await this.prisma.user.findUnique({
      where: { publicId: targetPublicId },
    });
    if (!target) {
      throw new NotFoundException('Utente non trovato');
    }

    // Non tocca le ExpenseContribution storiche: le spese passate restano
    // intatte. Le notifiche su questo gruppo invece spariscono: chi esce non
    // lo puo' piu' aprire.
    await this.prisma.$transaction(async (tx) => {
      await tx.userOnGroup.deleteMany({
        where: { groupId: group.id, userId: target.id },
      });
      await this.notificationService.forgetGroup(tx, target.id, group.id);
    });

    // Ricarica per id, senza ripassare da assertMember (come faceva findOne):
    // chi ha tolto se stesso non e' piu' membro e riceveva un 403 su
    // un'operazione in realta' riuscita.
    const updated = await this.prisma.group.findUniqueOrThrow({
      where: { id: group.id },
      include: MEMBERS_INCLUDE,
    });
    return this.toResponse(updated);
  }

  // GROUP_ADDED a chi entra subito, GROUP_INVITED a chi deve accettare.
  private async notifyAdded(
    tx: Prisma.TransactionClient,
    actorId: number,
    groupId: number,
    addedIds: number[],
    invitedIds: number[],
  ) {
    await this.notificationService.notify(
      tx,
      addedIds.filter((id) => !invitedIds.includes(id)),
      { type: 'GROUP_ADDED', actorId, groupId },
    );
    await this.notificationService.notify(tx, invitedIds, {
      type: 'GROUP_INVITED',
      actorId,
      groupId,
    });
  }

  // Il mio invito in attesa in quel gruppo, o 404.
  private async findInvitation(userPublicId: string, groupPublicId: string) {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
    });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    const group = await this.prisma.group.findUnique({
      where: { publicId: groupPublicId },
      include: MEMBERS_INCLUDE,
    });
    const invitation = group?.usersOnGroup.find(
      (link) => link.userId === user.id && link.pending,
    );
    if (!group || !invitation) {
      throw new NotFoundException('Nessun invito in attesa in questo gruppo');
    }
    return { user, group, invitation };
  }

  // Carica gli utenti dai publicId e verifica che esistano tutti.
  private async resolveMembers(memberPublicIds: string[]) {
    const uniqueIds = [...new Set(memberPublicIds)];
    const members = await this.prisma.user.findMany({
      where: { publicId: { in: uniqueIds } },
    });
    if (members.length !== uniqueIds.length) {
      throw new BadRequestException('Uno o più membri non esistono');
    }
    return members;
  }

  // Ritorna il gruppo (con membri) solo se il chiamante ne fa parte.
  private async assertMember(
    userPublicId: string,
    groupPublicId: string,
  ): Promise<GroupWithMembers> {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
    });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    const group = await this.prisma.group.findUnique({
      where: { publicId: groupPublicId },
      include: MEMBERS_INCLUDE,
    });
    if (!group) {
      throw new NotFoundException('Gruppo non trovato');
    }
    // Un invito non ancora accettato non basta.
    if (!group.usersOnGroup.some((link) => link.userId === user.id && !link.pending)) {
      throw new ForbiddenException('Non fai parte di questo gruppo');
    }

    return group;
  }

  private toResponse(group: GroupWithMembers) {
    return {
      publicId: group.publicId,
      name: group.name,
      createdDate: group.createdDate,
      members: group.usersOnGroup.filter((link) => !link.pending).map((link) => link.user),
      invited: group.usersOnGroup.filter((link) => link.pending).map((link) => link.user),
    };
  }
}
