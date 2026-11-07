import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nicknameError, normalizeNickname } from './nickname';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ricerca esatta (2026-10-25): con una `@` e' un'email, altrimenti un
   * nickname (che non puo' contenere `@`, vedi nickname.ts). Niente ricerca
   * per parte del nome: una spesa si crea solo con chi si conosce, e "pip"
   * non deve piu' elencare tutti i Pippo dell'app.
   *
   * Restituisce un array di 0 o 1 utenti, mai chi cerca e mai l'email
   * (anche quando si e' cercato per email: chi cerca la conosce gia').
   */
  async getUser(query: string, callerPublicId: string) {
    const q = query.trim();
    if (!q) {
      return [];
    }
    // nickName e' citext: l'uguaglianza ignora le maiuscole. Le email sono
    // salvate in minuscolo (add-users.mts, seed.ts).
    const user = await this.prisma.user.findUnique({
      where: q.includes('@') ? { email: q.toLowerCase() } : { nickName: q },
      select: {
        publicId: true,
        nickName: true,
        // Chi mi ha bloccato non lo trovo (vedi blocks.ts).
        blocks: { where: { blocked: { publicId: callerPublicId } }, select: { id: true } },
      },
    });

    if (!user || user.publicId === callerPublicId || user.blocks.length > 0) {
      return [];
    }
    return [{ publicId: user.publicId, nickName: user.nickName }];
  }

  /**
   * I contatti (2026-11-07): chi condivide gia' con me una spesa o un gruppo,
   * per nickname. Li elenca la scelta dei partecipanti, come i "friends"
   * automatici di Splitwise: con chi non c'e' ancora si usa la ricerca esatta.
   */
  async contacts(userPublicId: string) {
    const me = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    if (!me) {
      return [];
    }
    return this.prisma.user.findMany({
      where: {
        id: { not: me.id },
        // Niente blocchi in nessuna delle due direzioni.
        blocks: { none: { blockedId: me.id } },
        blockedBy: { none: { blockerId: me.id } },
        OR: [
          {
            expenseContributions: {
              some: { expense: { expenseContributions: { some: { userId: me.id } } } },
            },
          },
          {
            userOnGroups: {
              some: { group: { usersOnGroup: { some: { userId: me.id } } } },
            },
          },
        ],
      },
      select: { publicId: true, nickName: true },
      orderBy: { nickName: 'asc' },
    });
  }

  /** Chi ho bloccato, dal piu' recente. */
  async blocks(userPublicId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blocker: { publicId: userPublicId } },
      orderBy: { createdDate: 'desc' },
      select: { blocked: { select: { publicId: true, nickName: true } } },
    });
    return rows.map((row) => row.blocked);
  }

  // Idempotente: bloccare due volte non e' un errore.
  async block(userPublicId: string, targetPublicId: string) {
    if (userPublicId === targetPublicId) {
      throw new BadRequestException('Non puoi bloccare te stesso');
    }
    const [me, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { publicId: userPublicId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { publicId: targetPublicId }, select: { id: true } }),
    ]);
    if (!me || !target) {
      throw new NotFoundException('Utente non trovato');
    }
    await this.prisma.userBlock.createMany({
      data: [{ blockerId: me.id, blockedId: target.id }],
      skipDuplicates: true,
    });
  }

  async unblock(userPublicId: string, targetPublicId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blocker: { publicId: userPublicId }, blocked: { publicId: targetPublicId } },
    });
  }

  /**
   * Cambio del proprio nickname. Gli errori hanno un `code` (NICKNAME_*) che
   * il frontend traduce: il backend non genera testi per l'utente.
   *
   * L'unicita' senza maiuscole la garantisce il DB (colonna citext con
   * @unique): un controllo con findFirst prima dell'update lascerebbe passare
   * due richieste quasi simultanee per "Pippo" e "PIPPO".
   *
   * E' anche il passo /welcome di chi si e' appena registrato: un nickname
   * scelto (anche uguale a quello provvisorio) chiude `needsName`.
   */
  async updateMe(userPublicId: string, rawNickName: string) {
    const nickName = normalizeNickname(rawNickName);
    const error = nicknameError(nickName);
    if (error) {
      throw new BadRequestException({ statusCode: 400, code: error, message: error });
    }

    try {
      return await this.prisma.user.update({
        where: { publicId: userPublicId },
        data: { nickName, needsName: false },
        select: { publicId: true, nickName: true, email: true, needsName: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ statusCode: 409, code: 'NICKNAME_TAKEN', message: 'NICKNAME_TAKEN' });
      }
      throw e;
    }
  }
}
