import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoryService } from '../category/category.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

// Degli utenti collegati a una spesa si espongono solo publicId e nickName:
// includere la riga intera mandava email, id interno e refreshToken di ogni
// partecipante a chiunque vedesse la spesa.
const USER_SELECT = { publicId: true, nickName: true } as const;

// Forma unica delle spese restituite dall'API (liste, dettaglio, modifica).
const EXPENSE_INCLUDE = {
  createdBy: { select: USER_SELECT },
  paidBy: { select: USER_SELECT },
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
  expenseContributions: {
    select: { id: true, share: true, user: { select: USER_SELECT } },
  },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private categoryService: CategoryService,
  ) {}

  async findMine(userPublicId: string) {
    const user = await this.findUser(userPublicId);

    return this.prisma.expense.findMany({
      where: { expenseContributions: { some: { userId: user.id } } },
      orderBy: { createdDate: 'desc' },
      include: EXPENSE_INCLUDE,
    });
  }

  // Spese di un gruppo: visibili solo ai suoi membri.
  async findByGroup(userPublicId: string, groupPublicId: string) {
    const user = await this.findUser(userPublicId);

    const group = await this.prisma.group.findUnique({
      where: { publicId: groupPublicId },
      include: { usersOnGroup: true },
    });
    if (!group) {
      throw new NotFoundException('Gruppo non trovato');
    }
    if (!group.usersOnGroup.some((link) => link.userId === user.id)) {
      throw new ForbiddenException('Non fai parte di questo gruppo');
    }

    return this.prisma.expense.findMany({
      where: { groupId: group.id },
      orderBy: { createdDate: 'desc' },
      include: EXPENSE_INCLUDE,
    });
  }

  // Una spesa e' visibile a chi ci contribuisce e, se e' di un gruppo, a tutti
  // i membri del gruppo (stessa regola di findByGroup).
  async findOne(userPublicId: string, expensePublicId: string) {
    const user = await this.findUser(userPublicId);

    const expense = await this.prisma.expense.findUnique({
      where: { publicId: expensePublicId },
      include: {
        ...EXPENSE_INCLUDE,
        group: {
          select: {
            publicId: true,
            name: true,
            usersOnGroup: { where: { userId: user.id } },
          },
        },
      },
    });
    if (!expense) {
      throw new NotFoundException('Spesa non trovata');
    }

    const isContributor = expense.expenseContributions.some(
      (c) => c.user.publicId === user.publicId,
    );
    const isGroupMember = (expense.group?.usersOnGroup.length ?? 0) > 0;
    if (!isContributor && !isGroupMember) {
      throw new ForbiddenException('Non puoi vedere questa spesa');
    }

    // Stessa forma di EXPENSE_INCLUDE: il controllo di appartenenza non esce.
    const { group, ...rest } = expense;
    return {
      ...rest,
      group: group && { publicId: group.publicId, name: group.name },
    };
  }

  async create(creatorPublicId: string, dto: CreateExpenseDto) {
    const creator = await this.findUser(creatorPublicId, 'Creatore non trovato');

    const participantIds = await this.resolveParticipants(
      dto.participantPublicIds ?? [],
    );

    // Se la spesa è legata a un gruppo, i suoi membri diventano contributori.
    let groupId: number | null = null;
    let groupMemberIds: number[] = [];
    if (dto.groupPublicId) {
      ({ groupId, groupMemberIds } = await this.resolveGroup(
        dto.groupPublicId,
        creator.id,
      ));
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

    const contributorIds = this.contributorIds(
      creator.id,
      participantIds,
      groupMemberIds,
    );
    const payerId = await this.resolvePayer(
      dto.paidByPublicId ?? creator.publicId,
      contributorIds,
    );

    return this.prisma.expense.create({
      data: {
        description: dto.description?.trim() ?? '',
        amount: dto.amount,
        createdBy: { connect: { id: creator.id } },
        paidBy: { connect: { id: payerId } },
        ...(groupId ? { group: { connect: { id: groupId } } } : {}),
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
        expenseContributions: {
          create: this.contributions(dto.amount, contributorIds),
        },
      },
      include: EXPENSE_INCLUDE,
    });
  }

  // Modifica (PATCH parziale). Le ExpenseContribution vengono sempre
  // ricostruite da zero, perche' importo, partecipanti e gruppo cambiano tutti
  // la quota di ognuno. Il creatore originale resta sempre un contributore,
  // come alla creazione, anche quando a modificare e' un altro.
  async update(
    userPublicId: string,
    expensePublicId: string,
    dto: UpdateExpenseDto,
  ) {
    const user = await this.findUser(userPublicId);
    const expense = await this.findEditable(user.id, expensePublicId);

    const currentGroupMemberIds =
      expense.group?.usersOnGroup.map((link) => link.userId) ?? [];

    // Gruppo: omesso = invariato (con i membri *attuali*, quindi chi e' entrato
    // nel gruppo dopo la creazione entra anche nella spesa), null = rimosso.
    // Per spostare la spesa in un altro gruppo bisogna esserne membri.
    let groupId = expense.groupId;
    let groupMemberIds = currentGroupMemberIds;
    if (dto.groupPublicId === null) {
      groupId = null;
      groupMemberIds = [];
    } else if (
      dto.groupPublicId !== undefined &&
      dto.groupPublicId !== expense.group?.publicId
    ) {
      ({ groupId, groupMemberIds } = await this.resolveGroup(
        dto.groupPublicId,
        user.id,
      ));
    }

    // Partecipanti singoli: omessi = quelli di prima, cioe' i contributori
    // attuali tolti il creatore e i membri del gruppo attuale.
    const participantIds =
      dto.participantPublicIds !== undefined
        ? await this.resolveParticipants(dto.participantPublicIds)
        : expense.expenseContributions
            .map((c) => c.userId)
            .filter(
              (id) =>
                id !== expense.createdById &&
                !currentGroupMemberIds.includes(id),
            );

    const contributorIds = this.contributorIds(
      expense.createdById,
      participantIds,
      groupMemberIds,
    );
    const payerId = await this.resolvePayer(
      dto.paidByPublicId ?? expense.paidBy.publicId,
      contributorIds,
    );

    // Categoria: omessa o invariata = nessun controllo (puo' essere una
    // categoria custom del creatore, che per chi modifica non sarebbe
    // "usabile"); una nuova deve essere preconfigurata o di chi modifica.
    let categoryId = expense.categoryId;
    if (dto.categoryPublicId === null) {
      categoryId = null;
    } else if (
      dto.categoryPublicId !== undefined &&
      dto.categoryPublicId !== expense.category?.publicId
    ) {
      const category = await this.categoryService.assertUsable(
        user.id,
        dto.categoryPublicId,
      );
      categoryId = category.id;
    }

    const amount = dto.amount ?? expense.amount.toNumber();

    // Nested write: Prisma la esegue in un'unica transazione.
    return this.prisma.expense.update({
      where: { id: expense.id },
      data: {
        description:
          dto.description !== undefined
            ? dto.description.trim()
            : expense.description,
        amount,
        paidBy: { connect: { id: payerId } },
        group: groupId ? { connect: { id: groupId } } : { disconnect: true },
        category: categoryId
          ? { connect: { id: categoryId } }
          : { disconnect: true },
        expenseContributions: {
          deleteMany: {},
          create: this.contributions(amount, contributorIds),
        },
      },
      include: EXPENSE_INCLUDE,
    });
  }

  // Eliminazione definitiva (hard delete): la spesa e le sue quote spariscono
  // e i saldi si ricalcolano senza. Stesso permesso della modifica.
  async remove(userPublicId: string, expensePublicId: string) {
    const user = await this.findUser(userPublicId);
    const expense = await this.findEditable(user.id, expensePublicId);

    await this.prisma.$transaction([
      this.prisma.expenseContribution.deleteMany({
        where: { expenseId: expense.id },
      }),
      this.prisma.expense.delete({ where: { id: expense.id } }),
    ]);
  }

  private async findUser(publicId: string, notFoundMessage = 'Utente non trovato') {
    const user = await this.prisma.user.findUnique({ where: { publicId } });
    if (!user) {
      throw new NotFoundException(notFoundMessage);
    }
    return user;
  }

  // Permesso di modifica/eliminazione — decisione di prodotto (2026-09-25):
  // qualsiasi contributore della spesa, non solo il creatore. Un membro del
  // gruppo senza quota la vede ma non la tocca.
  private async findEditable(userId: number, expensePublicId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { publicId: expensePublicId },
      include: {
        paidBy: { select: USER_SELECT },
        category: { select: { publicId: true } },
        group: { select: { publicId: true, usersOnGroup: true } },
        expenseContributions: { select: { userId: true } },
      },
    });
    if (!expense) {
      throw new NotFoundException('Spesa non trovata');
    }
    if (!expense.expenseContributions.some((c) => c.userId === userId)) {
      throw new ForbiddenException(
        'Solo chi partecipa alla spesa puo\' modificarla o eliminarla',
      );
    }
    return expense;
  }

  private async resolveParticipants(publicIds: string[]) {
    const participants = await this.prisma.user.findMany({
      where: { publicId: { in: publicIds } },
    });
    if (participants.length !== new Set(publicIds).size) {
      throw new BadRequestException('Uno o più partecipanti non esistono');
    }
    return participants.map((p) => p.id);
  }

  private async resolveGroup(groupPublicId: string, actorId: number) {
    const group = await this.prisma.group.findUnique({
      where: { publicId: groupPublicId },
      include: { usersOnGroup: true },
    });
    if (!group) {
      throw new NotFoundException('Gruppo non trovato');
    }
    if (!group.usersOnGroup.some((link) => link.userId === actorId)) {
      throw new ForbiddenException('Non fai parte di questo gruppo');
    }
    return {
      groupId: group.id as number | null,
      groupMemberIds: group.usersOnGroup.map((link) => link.userId),
    };
  }

  // Unione deduplicata: creatore + partecipanti + membri del gruppo.
  // (Chiude anche il vecchio buco del doppio conteggio quando lo stesso
  // utente compariva due volte tra i partecipanti.)
  private contributorIds(
    creatorId: number,
    participantIds: number[],
    groupMemberIds: number[],
  ) {
    return [...new Set<number>([creatorId, ...participantIds, ...groupMemberIds])];
  }

  // Chi ha pagato deve essere uno dei contributori, cosi' la spesa resta
  // sempre visibile a chi l'ha pagata (findMine filtra sulle
  // ExpenseContribution) e i saldi restano completi.
  private async resolvePayer(payerPublicId: string, contributorIds: number[]) {
    const payer = await this.prisma.user.findUnique({
      where: { publicId: payerPublicId },
    });
    if (!payer) {
      throw new BadRequestException('Chi ha pagato non esiste');
    }
    if (!contributorIds.includes(payer.id)) {
      throw new BadRequestException(
        'Chi ha pagato deve essere tra i partecipanti alla spesa',
      );
    }
    return payer.id;
  }

  private contributions(amount: number, contributorIds: number[]) {
    // TODO: permettere quote diverse invece di una divisione sempre equa tra i contributori.
    // TODO: gestire l'arrotondamento quando amount non è divisibile esattamente per il numero
    // di contributori (vale anche per lo split di gruppo: la somma delle share potrebbe non
    // coincidere con amount).
    const share = Math.round((amount / contributorIds.length) * 100) / 100;
    return contributorIds.map((userId) => ({
      share,
      user: { connect: { id: userId } },
    }));
  }
}
