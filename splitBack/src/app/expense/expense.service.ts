import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoryService } from '../category/category.service';
import { FriendService } from '../friend/friend.service';
import { NotificationService } from '../notification/notification.service';
import { ExpenseSnapshot } from '../notification/notification.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseShareDto } from './dto/expense-share.dto';
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
  // `pending` = quella persona non ha ancora accettato (non e' amica di
  // `invitedBy`): la spesa conta per tutti tranne che per lei.
  expenseContributions: {
    select: {
      id: true,
      share: true,
      pending: true,
      invitedBy: { select: USER_SELECT },
      user: { select: USER_SELECT },
    },
  },
} satisfies Prisma.ExpenseInclude;

// Dalla spesa piu' recente: per giorno scelto dall'utente, poi, a parita' di
// giorno, per ordine di inserimento.
const EXPENSE_ORDER = [
  { date: 'desc' },
  { createdDate: 'desc' },
] satisfies Prisma.ExpenseOrderByWithRelationInput[];

// Categoria preconfigurata delle spese di compensazione della divisione
// intelligente (seed.ts; SMART_SPLIT_SLUG in splitFront models/category.model.ts).
const SMART_SPLIT_SLUG = 'smart-split';

// Le spese di compensazione si creano a gruppi di N senza descrizione: alla
// creazione non notificano (sarebbe solo rumore), all'eliminazione si'.
// Il batch ne crea al massimo 50 una per una: il timeout di default delle
// transazioni interattive (5 s) sarebbe stretto con il DB in un'altra regione.
const BATCH_TRANSACTION_TIMEOUT_MS = 20_000;

type ExpenseWithResponse = Prisma.ExpenseGetPayload<{
  include: typeof EXPENSE_INCLUDE;
}>;

// La spesa come la leggono modifica ed eliminazione (findEditable): uso
// interno, non esce dall'API.
const EDITABLE_INCLUDE = {
  paidBy: { select: USER_SELECT },
  category: { select: { publicId: true, slug: true } },
  // Solo i membri veri: un invito in attesa non porta nella spesa.
  group: {
    select: { publicId: true, usersOnGroup: { where: { pending: false } } },
  },
  expenseContributions: {
    select: {
      userId: true,
      share: true,
      pending: true,
      invitedById: true,
      user: { select: { publicId: true } },
    },
  },
} satisfies Prisma.ExpenseInclude;

type EditableExpense = Prisma.ExpenseGetPayload<{
  include: typeof EDITABLE_INCLUDE;
}>;

// Una quota prima di diventare riga: chi e quanto.
type ShareRow = { userId: number; share: Prisma.Decimal | number };

// In attesa o no, e chi ha aggiunto la persona (vedi ExpenseContribution).
type ContributorStatus = { pending: boolean; invitedById: number | null };
const ACCEPTED: ContributorStatus = { pending: false, invitedById: null };

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private categoryService: CategoryService,
    private friendService: FriendService,
    private notificationService: NotificationService,
  ) {}

  async findMine(userPublicId: string) {
    const user = await this.findUser(userPublicId);

    return this.prisma.expense.findMany({
      where: { expenseContributions: { some: { userId: user.id } } },
      orderBy: EXPENSE_ORDER,
      include: EXPENSE_INCLUDE,
    });
  }

  // Spese di un gruppo: visibili solo ai suoi membri.
  async findByGroup(userPublicId: string, groupPublicId: string) {
    const user = await this.findUser(userPublicId);

    const group = await this.prisma.group.findUnique({
      where: { publicId: groupPublicId },
      include: { usersOnGroup: { where: { pending: false } } },
    });
    if (!group) {
      throw new NotFoundException('Gruppo non trovato');
    }
    if (!group.usersOnGroup.some((link) => link.userId === user.id)) {
      throw new ForbiddenException('Non fai parte di questo gruppo');
    }

    return this.prisma.expense.findMany({
      where: { groupId: group.id },
      orderBy: EXPENSE_ORDER,
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
            usersOnGroup: { where: { userId: user.id, pending: false } },
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
    const { data, contributorIds, status } = await this.buildCreateData(creator, dto);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({ data, include: EXPENSE_INCLUDE });
      await this.notifyCreated(tx, creator.id, expense, contributorIds, status);
      return expense;
    });
  }

  // Crea piu' spese tutte insieme o nessuna: le usa la divisione intelligente,
  // le cui spese di compensazione lasciano invariato il netto di ognuno solo
  // prese tutte insieme (una da sola sposta soldi da una persona a un'altra).
  // Ogni spesa passa dalle stesse validazioni di `create`.
  async createMany(creatorPublicId: string, dtos: CreateExpenseDto[]) {
    const creator = await this.findUser(creatorPublicId, 'Creatore non trovato');

    const prepared: Awaited<ReturnType<ExpenseService['buildCreateData']>>[] = [];
    for (const dto of dtos) {
      prepared.push(await this.buildCreateData(creator, dto));
    }

    return this.prisma.$transaction(
      async (tx) => {
        const created: ExpenseWithResponse[] = [];
        for (const { data, contributorIds, status } of prepared) {
          const expense = await tx.expense.create({ data, include: EXPENSE_INCLUDE });
          await this.notifyCreated(tx, creator.id, expense, contributorIds, status);
          created.push(expense);
        }
        return created;
      },
      { timeout: BATCH_TRANSACTION_TIMEOUT_MS },
    );
  }

  // Validazioni di una nuova spesa e dati per Prisma (condivise da `create` e
  // `createMany`), piu' gli id dei contributori per le notifiche: la risposta
  // dell'API non li contiene.
  private async buildCreateData(
    creator: { id: number; publicId: string },
    dto: CreateExpenseDto,
  ): Promise<{
    data: Prisma.ExpenseCreateInput;
    contributorIds: number[];
    status: Map<number, ContributorStatus>;
  }> {
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
    const rows = dto.shares
      ? await this.customContributions(dto.amount, contributorIds, dto.shares)
      : this.equalContributions(dto.amount, contributorIds);
    // Il creatore e i membri del gruppo ci sono gia' per consenso; gli altri
    // solo se amici del creatore, se no restano in attesa.
    const status = await this.contributorStatus(creator.id, contributorIds, [
      creator.id,
      ...groupMemberIds,
    ]);

    const data: Prisma.ExpenseCreateInput = {
      description: dto.description?.trim() ?? '',
      amount: dto.amount,
      // Omessa = default del DB (CURRENT_DATE). `createdDate` non si passa
      // mai: la scrive il DB.
      ...(dto.date ? { date: toDay(dto.date) } : {}),
      createdBy: { connect: { id: creator.id } },
      paidBy: { connect: { id: payerId } },
      ...(groupId ? { group: { connect: { id: groupId } } } : {}),
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
      expenseContributions: { create: this.contributionInputs(rows, status) },
    };
    return { data, contributorIds, status };
  }

  private async notifyCreated(
    tx: Prisma.TransactionClient,
    actorId: number,
    expense: ExpenseWithResponse,
    contributorIds: number[],
    status: Map<number, ContributorStatus>,
  ) {
    if (expense.category?.slug === SMART_SPLIT_SLUG) {
      return;
    }
    await this.notifyEntered(tx, actorId, expense.id, contributorIds, status);
  }

  // Chi entra in una spesa: EXPENSE_ADDED se c'e' gia' per consenso (amico,
  // membro del gruppo), EXPENSE_PENDING se la deve accettare.
  private async notifyEntered(
    tx: Prisma.TransactionClient,
    actorId: number,
    expenseId: number,
    userIds: number[],
    status: Map<number, ContributorStatus>,
  ) {
    const pending = userIds.filter((id) => status.get(id)?.pending);
    await this.notificationService.notify(
      tx,
      userIds.filter((id) => !pending.includes(id)),
      { type: 'EXPENSE_ADDED', actorId, expenseId },
    );
    await this.notificationService.notify(tx, pending, {
      type: 'EXPENSE_PENDING',
      actorId,
      expenseId,
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

    // Quote: array = diseguali, null = eque. Omesse = restano quelle attuali
    // finche' valgono (stesso importo, stessi contributori), altrimenti eque.
    let rows: ShareRow[];
    if (dto.shares) {
      rows = await this.customContributions(
        amount,
        contributorIds,
        dto.shares,
      );
    } else if (
      dto.shares === undefined &&
      toCents(amount) === toCents(expense.amount.toNumber()) &&
      this.sameIds(
        contributorIds,
        expense.expenseContributions.map((c) => c.userId),
      )
    ) {
      rows = expense.expenseContributions.map((c) => ({
        userId: c.userId,
        share: c.share,
      }));
    } else {
      rows = this.equalContributions(amount, contributorIds);
    }

    // Chi c'era resta com'era (in attesa o no); chi entra ora e' accettato se
    // e' il creatore, chi modifica, un membro del gruppo o un amico di chi
    // modifica, altrimenti resta in attesa.
    const status = await this.contributorStatus(
      user.id,
      contributorIds,
      [expense.createdById, user.id, ...groupMemberIds],
      new Map(
        expense.expenseContributions.map((c) => [
          c.userId,
          { pending: c.pending, invitedById: c.invitedById },
        ]),
      ),
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: {
          description:
            dto.description !== undefined
              ? dto.description.trim()
              : expense.description,
          amount,
          ...(dto.date ? { date: toDay(dto.date) } : {}),
          paidBy: { connect: { id: payerId } },
          group: groupId ? { connect: { id: groupId } } : { disconnect: true },
          category: categoryId
            ? { connect: { id: categoryId } }
            : { disconnect: true },
          expenseContributions: {
            deleteMany: {},
            create: this.contributionInputs(rows, status),
          },
        },
        include: EXPENSE_INCLUDE,
      });
      await this.notifyUpdated(tx, user.id, expense, updated, contributorIds, status);
      return updated;
    });
  }

  /**
   * Notifiche di una modifica, per differenza fra prima e dopo:
   * - chi entra nella spesa: EXPENSE_ADDED (anche chi arriva perche' e'
   *   entrato nel gruppo dopo la creazione, che prima cambiava le quote senza
   *   che nessuno lo sapesse);
   * - chi resta: EXPENSE_UPDATED, solo se e' cambiato qualcosa che vede (un
   *   PATCH identico, come quello di una form salvata senza toccare niente,
   *   non notifica);
   * - chi esce: perde le notifiche su questa spesa e riceve EXPENSE_REMOVED
   *   con la spesa com'era, perche' non puo' piu' aprirla.
   */
  private async notifyUpdated(
    tx: Prisma.TransactionClient,
    actorId: number,
    before: EditableExpense,
    after: ExpenseWithResponse,
    contributorIds: number[],
    status: Map<number, ContributorStatus>,
  ) {
    const beforeIds = before.expenseContributions.map((c) => c.userId);
    const added = contributorIds.filter((id) => !beforeIds.includes(id));
    // Chi deve ancora accettare non riceve gli aggiornamenti: apre la spesa
    // dalla sua EXPENSE_PENDING e la vede com'e' ora.
    const kept = contributorIds.filter(
      (id) => beforeIds.includes(id) && !status.get(id)?.pending,
    );
    const removed = beforeIds.filter((id) => !contributorIds.includes(id));

    await this.notifyEntered(tx, actorId, after.id, added, status);

    if (this.visiblyChanged(before, after)) {
      await this.notificationService.notify(tx, kept, {
        type: 'EXPENSE_UPDATED',
        actorId,
        expenseId: after.id,
      });
    }

    await this.notificationService.forgetExpense(tx, removed, after.id);
    await this.notificationService.notify(tx, removed, {
      type: 'EXPENSE_REMOVED',
      actorId,
      params: snapshot(before),
    });
  }

  // Qualcosa che chi resta nella spesa vede: i campi mostrati nel dettaglio o
  // la quota di qualcuno che c'era gia'.
  private visiblyChanged(before: EditableExpense, after: ExpenseWithResponse) {
    const shareBefore = new Map(
      before.expenseContributions.map((c) => [
        c.user.publicId,
        toCents(c.share.toNumber()),
      ]),
    );
    const shareChanged = after.expenseContributions.some((c) => {
      const previous = shareBefore.get(c.user.publicId);
      return previous !== undefined && previous !== toCents(c.share.toNumber());
    });

    return (
      shareChanged ||
      after.description !== before.description ||
      toCents(after.amount.toNumber()) !== toCents(before.amount.toNumber()) ||
      after.date.getTime() !== before.date.getTime() ||
      after.paidById !== before.paidById ||
      after.groupId !== before.groupId ||
      after.categoryId !== before.categoryId
    );
  }

  // Eliminazione definitiva (hard delete): la spesa e le sue quote spariscono
  // e i saldi si ricalcolano senza. Stesso permesso della modifica.
  async remove(userPublicId: string, expensePublicId: string) {
    const user = await this.findUser(userPublicId);
    const expense = await this.findEditable(user.id, expensePublicId);

    // EXPENSE_DELETED non punta alla spesa (porta l'istantanea), quindi
    // resta; il cascade cancella invece le notifiche vecchie su questa spesa.
    // Anche le spese della divisione intelligente notificano: eliminarne una
    // sposta i netti dei membri.
    await this.prisma.$transaction(async (tx) => {
      await this.notificationService.notify(
        tx,
        expense.expenseContributions.map((c) => c.userId),
        { type: 'EXPENSE_DELETED', actorId: user.id, params: snapshot(expense) },
      );
      await tx.expenseContribution.deleteMany({
        where: { expenseId: expense.id },
      });
      await tx.expense.delete({ where: { id: expense.id } });
    });
  }

  /**
   * Rifiuta una spesa in attesa (decisione dell'utente, 2026-10-25): la mia
   * quota passa a chi mi ci ha messo (o al creatore, se quella persona non e'
   * piu' nella spesa), che diventa anche il pagante se avevo pagato io. Le
   * altre spese in attesa della stessa persona restano da decidere.
   */
  async reject(userPublicId: string, expensePublicId: string) {
    const user = await this.findUser(userPublicId);
    const expense = await this.prisma.expense.findUnique({
      where: { publicId: expensePublicId },
      select: {
        id: true,
        createdById: true,
        paidById: true,
        expenseContributions: {
          select: { id: true, userId: true, share: true, pending: true, invitedById: true },
        },
      },
    });
    if (!expense) {
      throw new NotFoundException('Spesa non trovata');
    }
    const mine = expense.expenseContributions.find((c) => c.userId === user.id);
    if (!mine) {
      throw new ForbiddenException('Non partecipi a questa spesa');
    }
    if (!mine.pending) {
      throw new BadRequestException('Questa spesa non e\' in attesa: l\'hai gia\' accettata');
    }
    const bearer =
      expense.expenseContributions.find(
        (c) => c.userId === mine.invitedById && !c.pending,
      ) ?? expense.expenseContributions.find((c) => c.userId === expense.createdById);
    if (!bearer) {
      // Il creatore e' sempre fra i contributori: qui non si arriva.
      throw new BadRequestException('Spesa senza creatore');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.expenseContribution.delete({ where: { id: mine.id } });
      await tx.expenseContribution.update({
        where: { id: bearer.id },
        data: { share: { increment: mine.share } },
      });
      if (expense.paidById === user.id) {
        await tx.expense.update({
          where: { id: expense.id },
          data: { paidBy: { connect: { id: bearer.userId } } },
        });
      }
      await this.notificationService.forgetExpense(tx, [user.id], expense.id);
      await this.notificationService.notify(tx, [bearer.userId], {
        type: 'EXPENSE_REJECTED',
        actorId: user.id,
        expenseId: expense.id,
      });
    });
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
  private async findEditable(
    userId: number,
    expensePublicId: string,
  ): Promise<EditableExpense> {
    const expense = await this.prisma.expense.findUnique({
      where: { publicId: expensePublicId },
      include: EDITABLE_INCLUDE,
    });
    if (!expense) {
      throw new NotFoundException('Spesa non trovata');
    }
    if (!expense.expenseContributions.some((c) => c.userId === userId)) {
      throw new ForbiddenException(
        'Solo chi partecipa alla spesa puo\' modificarla o eliminarla',
      );
    }
    // Chi deve ancora accettare puo' solo accettare o rifiutare.
    if (expense.expenseContributions.some((c) => c.userId === userId && c.pending)) {
      throw new ForbiddenException(
        'Prima accetta o rifiuta la spesa',
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
    // Solo i membri veri: chi e' invitato e non ha accettato non entra nelle
    // spese del gruppo, e non ci puo' aggiungere spese.
    const group = await this.prisma.group.findUnique({
      where: { publicId: groupPublicId },
      include: { usersOnGroup: { where: { pending: false } } },
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

  // Divisione equa al centesimo: i centesimi che avanzano (10 EUR in 3 = 3,33
  // con 1 cent di resto) vanno uno a testa ai primi contributori, cioe' al
  // creatore per primo. Cosi' la somma delle quote fa sempre esattamente
  // `amount`, come nella divisione diseguale. Il frontend (utils/split.ts)
  // divide allo stesso modo.
  private equalContributions(amount: number, contributorIds: number[]) {
    const total = toCents(amount);
    const base = Math.floor(total / contributorIds.length);
    const remainder = total - base * contributorIds.length;
    return contributorIds.map((userId, index): ShareRow => ({
      userId,
      share: (base + (index < remainder ? 1 : 0)) / 100,
    }));
  }

  // Divisione diseguale: una quota per ciascun contributore, nessuno escluso e
  // nessuno in piu', e somma (in centesimi) uguale all'importo.
  private async customContributions(
    amount: number,
    contributorIds: number[],
    shares: ExpenseShareDto[],
  ) {
    const publicIds = shares.map((s) => s.userPublicId);
    if (new Set(publicIds).size !== publicIds.length) {
      throw new BadRequestException('Una persona compare due volte nelle quote');
    }

    const users = await this.prisma.user.findMany({
      where: { publicId: { in: publicIds } },
      select: { id: true, publicId: true },
    });
    const idByPublicId = new Map(users.map((u) => [u.publicId, u.id]));
    const shareIds = publicIds.map((publicId) => idByPublicId.get(publicId));
    if (
      shareIds.some((id) => id === undefined) ||
      !this.sameIds(shareIds as number[], contributorIds)
    ) {
      throw new BadRequestException(
        'Le quote devono riguardare esattamente i partecipanti alla spesa',
      );
    }

    const sum = shares.reduce((acc, s) => acc + toCents(s.share), 0);
    if (sum !== toCents(amount)) {
      throw new BadRequestException(
        "La somma delle quote deve essere uguale all'importo della spesa",
      );
    }

    return shares.map((s, index): ShareRow => ({
      userId: shareIds[index] as number,
      share: toCents(s.share) / 100,
    }));
  }

  /**
   * In attesa o no, per ognuno dei contributori:
   * - `acceptedIds` (creatore, chi agisce, membri del gruppo) ci sono per
   *   consenso;
   * - chi era gia' nella spesa (`previous`) resta com'era;
   * - gli altri sono accettati se amici di chi agisce, altrimenti restano in
   *   attesa finche' non accettano (e diventano amici).
   */
  private async contributorStatus(
    actorId: number,
    contributorIds: number[],
    acceptedIds: number[],
    previous = new Map<number, ContributorStatus>(),
  ) {
    const accepted = new Set(acceptedIds);
    const friends = await this.friendService.friendIdsAmong(
      this.prisma,
      actorId,
      contributorIds.filter((id) => !accepted.has(id) && !previous.has(id)),
    );
    return new Map(
      contributorIds.map((id): [number, ContributorStatus] => {
        if (accepted.has(id)) {
          return [id, ACCEPTED];
        }
        const before = previous.get(id);
        if (before) {
          return [id, before];
        }
        return [
          id,
          friends.has(id) ? ACCEPTED : { pending: true, invitedById: actorId },
        ];
      }),
    );
  }

  private contributionInputs(
    rows: ShareRow[],
    status: Map<number, ContributorStatus>,
  ): Prisma.ExpenseContributionCreateWithoutExpenseInput[] {
    return rows.map(({ userId, share }) => {
      const { pending, invitedById } = status.get(userId) ?? ACCEPTED;
      return {
        share,
        pending,
        ...(invitedById ? { invitedBy: { connect: { id: invitedById } } } : {}),
        user: { connect: { id: userId } },
      };
    });
  }

  private sameIds(a: number[], b: number[]) {
    const setA = new Set(a);
    return setA.size === new Set(b).size && b.every((id) => setA.has(id));
  }
}

// 'YYYY-MM-DD' -> Date a mezzanotte UTC, che Prisma salva nella colonna DATE
// come quello stesso giorno. Nelle risposte torna come
// 'YYYY-MM-DDT00:00:00.000Z': il giorno sono i primi 10 caratteri.
function toDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

// Importi in centesimi interi: confronti e somme senza errori di virgola mobile.
function toCents(value: number) {
  return Math.round(value * 100);
}

// La spesa com'era, per chi non potra' piu' aprirla (eliminata, o tolto).
function snapshot(expense: EditableExpense): ExpenseSnapshot {
  return {
    description: expense.description,
    amount: expense.amount.toString(),
    currency: expense.currency,
    categorySlug: expense.category?.slug ?? null,
  };
}
