import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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
      },
    });

    return user && user.publicId !== callerPublicId ? [user] : [];
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
