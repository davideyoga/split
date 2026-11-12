import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PushSubscribeDto } from '../dto/push-subscription.dto';
import { isSupportedPushEndpoint, isValidWebPushKeys } from './push-endpoint';

// Tetto per utente: chi si iscrive da un browser nuovo oltre questo numero fa
// uscire quello aggiornato meno di recente. Evita che la tabella cresca senza
// limiti per un solo account.
const MAX_DEVICES_PER_USER = 10;

/**
 * I dispositivi che ricevono le push di un utente (oggi i browser, Web Push).
 * Si iscrive e si cancella solo il proprio: dal Profilo, e al logout.
 */
@Injectable()
export class PushDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotente. Lo stesso browser (stesso endpoint) iscritto prima da un altro
   * utente passa a chi lo iscrive ora: sullo stesso dispositivo le push vanno
   * a chi lo usa adesso. Si richiama anche quando cambia la lingua dell'app.
   */
  async subscribe(userPublicId: string, dto: PushSubscribeDto): Promise<void> {
    if (!isSupportedPushEndpoint(dto.endpoint)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PUSH_ENDPOINT_UNSUPPORTED',
        message: 'PUSH_ENDPOINT_UNSUPPORTED',
      });
    }
    if (!isValidWebPushKeys(dto.keys.p256dh, dto.keys.auth)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PUSH_KEYS_INVALID',
        message: 'PUSH_KEYS_INVALID',
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    const device = {
      userId: user.id,
      platform: 'web',
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      locale: dto.locale,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.pushDevice.upsert({
        where: { endpoint: dto.endpoint },
        create: { ...device, endpoint: dto.endpoint },
        update: device,
      });
      const extra = await tx.pushDevice.findMany({
        where: { userId: user.id },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: MAX_DEVICES_PER_USER,
        select: { id: true },
      });
      if (extra.length > 0) {
        await tx.pushDevice.deleteMany({ where: { id: { in: extra.map((d) => d.id) } } });
      }
    });
  }

  /** Solo un proprio dispositivo: l'endpoint di un altro viene ignorato. */
  async unsubscribe(userPublicId: string, endpoint: string): Promise<void> {
    await this.prisma.pushDevice.deleteMany({
      where: { endpoint, user: { publicId: userPublicId } },
    });
  }
}
