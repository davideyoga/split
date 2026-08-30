import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

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

    const participants = await this.prisma.user.findMany({
      where: { publicId: { in: dto.participantPublicIds } },
    });
    if (participants.length !== dto.participantPublicIds.length) {
      throw new BadRequestException('Uno o più partecipanti non esistono');
    }

    // TODO: permettere quote diverse invece di una divisione sempre equa tra i partecipanti.
    // TODO: gestire l'arrotondamento quando amount non è divisibile esattamente per il numero di
    // partecipanti (la somma delle share potrebbe non coincidere con amount).
    const totalPeople = 1 + participants.length;
    const share = Math.round((dto.amount / totalPeople) * 100) / 100;

    const contributors = [creator, ...participants];

    return this.prisma.expense.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        createdBy: { connect: { id: creator.id } },
        paidBy: { connect: { id: creator.id } },
        expenseContributions: {
          create: contributors.map((contributor) => ({
            share,
            user: { connect: { id: contributor.id } },
          })),
        },
      },
      include: { expenseContributions: true },
    });
  }
}
