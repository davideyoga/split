import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nicknameError, normalizeNickname } from './nickname';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getUser(nickName: string) {
    // Una ricerca vuota non elenca gli utenti a caso.
    if (!nickName.trim()) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: {
        nickName: {
          contains: nickName,
          mode: 'insensitive',
        },
      },
      select: {
        publicId: true,
        nickName: true,
      },
      take: 10,
    });

    return users;
  }

  /**
   * Cambio del proprio nickname. Gli errori hanno un `code` (NICKNAME_*) che
   * il frontend traduce: il backend non genera testi per l'utente.
   *
   * L'unicita' senza maiuscole la garantisce il DB (colonna citext con
   * @unique): un controllo con findFirst prima dell'update lascerebbe passare
   * due richieste quasi simultanee per "Pippo" e "PIPPO".
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
        data: { nickName },
        select: { publicId: true, nickName: true, email: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ statusCode: 409, code: 'NICKNAME_TAKEN', message: 'NICKNAME_TAKEN' });
      }
      throw e;
    }
  }
}
