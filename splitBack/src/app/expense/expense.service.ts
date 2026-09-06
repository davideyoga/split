import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryService } from '../category/category.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private categoryService: CategoryService,
  ) {}

  async findMine(userPublicId: string) {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
    });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    return this.prisma.expense.findMany({
      where: { expenseContributions: { some: { userId: user.id } } },
      orderBy: { createdDate: 'desc' },
      include: {
        paidBy: true,
        group: { select: { publicId: true, name: true } },
        category: {
          select: {
            publicId: true,
            slug: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        expenseContributions: { include: { user: true } },
      },
    });
  }

  async create(creatorPublicId: string, dto: CreateExpenseDto) {
    const creator = await this.prisma.user.findUnique({
      where: { publicId: creatorPublicId },
    });
    if (!creator) {
      throw new NotFoundException('Creatore non trovato');
    }

    const participantPublicIds = dto.participantPublicIds ?? [];
    const participants = await this.prisma.user.findMany({
      where: { publicId: { in: participantPublicIds } },
    });
    if (participants.length !== participantPublicIds.length) {
      throw new BadRequestException('Uno o più partecipanti non esistono');
    }

    // Se la spesa è legata a un gruppo, i suoi membri diventano contributori.
    let groupId: number | null = null;
    let groupMemberIds: number[] = [];
    if (dto.groupPublicId) {
      const group = await this.prisma.group.findUnique({
        where: { publicId: dto.groupPublicId },
        include: { usersOnGroup: true },
      });
      if (!group) {
        throw new NotFoundException('Gruppo non trovato');
      }
      if (!group.usersOnGroup.some((link) => link.userId === creator.id)) {
        throw new ForbiddenException('Non fai parte di questo gruppo');
      }
      groupId = group.id;
      groupMemberIds = group.usersOnGroup.map((link) => link.userId);
    }

    // La categoria e' facoltativa: deve essere una preconfigurata o una del
    // creatore (la validazione sta in CategoryService).
    let categoryId: number | null = null;
    if (dto.categoryPublicId) {
      const category = await this.categoryService.assertUsable(
        creator.id,
        dto.categoryPublicId,
      );
      categoryId = category.id;
    }

    // Unione deduplicata: creatore + partecipanti + membri del gruppo.
    // (Chiude anche il vecchio buco del doppio conteggio quando lo stesso
    // utente compariva due volte tra i partecipanti.)
    const contributorIds = [
      ...new Set<number>([
        creator.id,
        ...participants.map((p) => p.id),
        ...groupMemberIds,
      ]),
    ];

    // TODO: permettere quote diverse invece di una divisione sempre equa tra i contributori.
    // TODO: gestire l'arrotondamento quando amount non è divisibile esattamente per il numero
    // di contributori (vale anche per lo split di gruppo: la somma delle share potrebbe non
    // coincidere con amount).
    const share =
      Math.round((dto.amount / contributorIds.length) * 100) / 100;

    return this.prisma.expense.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        createdBy: { connect: { id: creator.id } },
        paidBy: { connect: { id: creator.id } },
        ...(groupId ? { group: { connect: { id: groupId } } } : {}),
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
        expenseContributions: {
          create: contributorIds.map((userId) => ({
            share,
            user: { connect: { id: userId } },
          })),
        },
      },
      include: { expenseContributions: true },
    });
  }
}
