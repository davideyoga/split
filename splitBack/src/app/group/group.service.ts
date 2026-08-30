import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupMembersDto } from './dto/group-members.dto';
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
  // TODO before beta: qualsiasi membro puo' rinominare il gruppo e aggiungere/
  // rimuovere membri. Aggiungere Group.createdById (owner) e limitare le
  // mutazioni all'owner.
  constructor(private prisma: PrismaService) {}

  async create(creatorPublicId: string, dto: CreateGroupDto) {
    const creator = await this.prisma.user.findUnique({
      where: { publicId: creatorPublicId },
    });
    if (!creator) {
      throw new NotFoundException('Creatore non trovato');
    }

    const members = await this.resolveMembers(dto.memberPublicIds);

    // Il creatore fa sempre parte del gruppo, anche se non elencato nei membri.
    const memberIds = [...new Set([creator.id, ...members.map((m) => m.id)])];

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        usersOnGroup: {
          create: memberIds.map((userId) => ({
            user: { connect: { id: userId } },
          })),
        },
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

  async addMembers(
    userPublicId: string,
    groupPublicId: string,
    dto: GroupMembersDto,
  ) {
    const group = await this.assertMember(userPublicId, groupPublicId);
    const members = await this.resolveMembers(dto.memberPublicIds);

    // Idempotente grazie a @@unique([groupId, userId]) su UserOnGroup.
    await this.prisma.userOnGroup.createMany({
      data: members.map((member) => ({
        groupId: group.id,
        userId: member.id,
      })),
      skipDuplicates: true,
    });

    return this.findOne(userPublicId, groupPublicId);
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

    // Non tocca le ExpenseContribution storiche: le spese passate restano intatte.
    await this.prisma.userOnGroup.deleteMany({
      where: { groupId: group.id, userId: target.id },
    });

    return this.findOne(userPublicId, groupPublicId);
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
