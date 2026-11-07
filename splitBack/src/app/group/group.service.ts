import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

// Ogni risposta espone i membri come utenti "leggeri" (publicId + nickName),
// come fa UserService.getUser per la ricerca.
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
  // TODO before beta: qualsiasi membro puo' rinominare il gruppo, creare o
  // revocare il link d'invito e rimuovere membri. Aggiungere Group.createdById (owner) e limitare le
  // mutazioni all'owner.
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // Il gruppo nasce col solo creatore: gli altri entrano col link d'invito
  // (decisione dell'utente, 2026-11-07; vedi InviteService).
  async create(creatorPublicId: string, dto: CreateGroupDto) {
    const creator = await this.prisma.user.findUnique({
      where: { publicId: creatorPublicId },
    });
    if (!creator) {
      throw new NotFoundException('Creatore non trovato');
    }

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        usersOnGroup: { create: [{ user: { connect: { id: creator.id } } }] },
      },
      include: MEMBERS_INCLUDE,
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
      where: { usersOnGroup: { some: { userId: user.id } } },
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

  // Il gruppo e l'id interno del chiamante, solo se ne fa parte. Lo usa anche
  // InviteService per i link d'invito.
  async memberOf(userPublicId: string, groupPublicId: string) {
    const group = await this.assertMember(userPublicId, groupPublicId);
    const userId = group.usersOnGroup.find((link) => link.user.publicId === userPublicId)?.userId;
    if (userId === undefined) {
      throw new ForbiddenException('Non fai parte di questo gruppo');
    }
    return { group, userId };
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
    if (!group.usersOnGroup.some((link) => link.userId === user.id)) {
      throw new ForbiddenException('Non fai parte di questo gruppo');
    }

    return group;
  }

  private toResponse(group: GroupWithMembers) {
    return {
      publicId: group.publicId,
      name: group.name,
      createdDate: group.createdDate,
      members: group.usersOnGroup.map((link) => link.user),
    };
  }
}
