import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

// Come per le spese, degli utenti si espongono solo publicId e nickName.
const USER_SELECT = { publicId: true, nickName: true } as const;

// Forma unica dei rimborsi restituiti dall'API. A differenza delle spese non
// esce nemmeno l'id interno: nessuno lo usa.
const SETTLEMENT_SELECT = {
  publicId: true,
  amount: true,
  currency: true,
  note: true,
  createdDate: true,
  from: { select: USER_SELECT },
  to: { select: USER_SELECT },
  createdBy: { select: USER_SELECT },
} satisfies Prisma.SettlementSelect;

@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  // Rimborsi in cui l'utente e' chi da' o chi riceve. Un rimborso coinvolge
  // sempre esattamente due persone, quindi questa lista e' completa per i
  // saldi "dal mio punto di vista" calcolati dal frontend.
  async findMine(userPublicId: string) {
    const user = await this.findUser(userPublicId);

    return this.prisma.settlement.findMany({
      where: { OR: [{ fromId: user.id }, { toId: user.id }] },
      orderBy: { createdDate: 'desc' },
      select: SETTLEMENT_SELECT,
    });
  }

  async create(userPublicId: string, dto: CreateSettlementDto) {
    const user = await this.findUser(userPublicId);

    if (dto.fromPublicId === dto.toPublicId) {
      throw new BadRequestException(
        'Chi da\' e chi riceve il rimborso devono essere persone diverse',
      );
    }
    if (dto.fromPublicId !== user.publicId && dto.toPublicId !== user.publicId) {
      throw new ForbiddenException(
        'Puoi registrare solo un rimborso che hai dato o ricevuto',
      );
    }

    const users = await this.prisma.user.findMany({
      where: { publicId: { in: [dto.fromPublicId, dto.toPublicId] } },
      select: { id: true, publicId: true },
    });
    const from = users.find((u) => u.publicId === dto.fromPublicId);
    const to = users.find((u) => u.publicId === dto.toPublicId);
    if (!from || !to) {
      throw new BadRequestException('Uno dei due utenti non esiste');
    }

    return this.prisma.settlement.create({
      data: {
        amount: dto.amount,
        note: dto.note?.trim() || null,
        from: { connect: { id: from.id } },
        to: { connect: { id: to.id } },
        createdBy: { connect: { id: user.id } },
      },
      select: SETTLEMENT_SELECT,
    });
  }

  // Eliminazione definitiva, permessa a chi ha dato o ricevuto il rimborso
  // (non solo a chi l'ha registrato): serve a correggere un errore di
  // inserimento, e la correzione la puo' notare uno qualsiasi dei due.
  async remove(userPublicId: string, settlementPublicId: string) {
    const user = await this.findUser(userPublicId);

    const settlement = await this.prisma.settlement.findUnique({
      where: { publicId: settlementPublicId },
    });
    if (!settlement) {
      throw new NotFoundException('Rimborso non trovato');
    }
    if (settlement.fromId !== user.id && settlement.toId !== user.id) {
      throw new ForbiddenException(
        'Solo chi ha dato o ricevuto il rimborso puo\' eliminarlo',
      );
    }

    await this.prisma.settlement.delete({ where: { id: settlement.id } });
  }

  private async findUser(publicId: string) {
    const user = await this.prisma.user.findUnique({ where: { publicId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    return user;
  }
}
