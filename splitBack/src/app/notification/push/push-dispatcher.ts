import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { markPushPending } from './push-request-state';
import { PushSender } from './push-sender';
import { PUSH_TYPES, PushSource, pushLocale, pushMessage, webPushPayload } from './push-text';

// Notifiche rimaste da gestire piu' vecchie di cosi' (server caduto fra il
// commit e l'invio) si segnano senza mandarle: una push di ieri non avvisa
// piu' di niente, e la campanella le ha comunque.
const MAX_AGE_MS = 60 * 60 * 1000;

// Quando non c'e' la fine di una richiesta da aspettare (client disconnesso
// prima della risposta, o notify() chiamato fuori da HTTP), la transazione
// puo' essere ancora aperta: si riprova dopo il timeout delle transazioni
// interattive di Prisma (5 s di default).
const LATE_FLUSH_DELAY_MS = 6_000;

// I dati della riga della campanella che servono al testo della push.
const PUSH_SELECT = {
  id: true,
  type: true,
  user: { select: { id: true, publicId: true } },
  actor: { select: { nickName: true } },
  expense: {
    select: {
      publicId: true,
      description: true,
      amount: true,
      currency: true,
      category: { select: { slug: true } },
    },
  },
  group: { select: { publicId: true, name: true } },
  settlement: {
    select: { amount: true, currency: true, to: { select: { publicId: true } } },
  },
} satisfies Prisma.NotificationSelect;

type PushRow = Prisma.NotificationGetPayload<{ select: typeof PUSH_SELECT }>;

/**
 * Manda le push delle notifiche nuove (doc/NotifichePush.md). La tabella
 * Notification fa da coda: `pushedAt` null = ancora da gestire. Chi crea le
 * notifiche (notify(), dentro la transazione di un'azione) non sa niente delle
 * push: chiama solo requestFlush(), e l'invio parte quando la richiesta HTTP
 * e' finita (PushFlushMiddleware), quindi dopo il commit. Una transazione
 * annullata non lascia righe, e non parte niente.
 */
@Injectable()
export class PushDispatcher implements OnApplicationBootstrap {
  private readonly logger = new Logger(PushDispatcher.name);
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: PushSender,
  ) {}

  // All'avvio: quelle rimaste indietro se il server si e' fermato fra un
  // commit e il suo invio.
  onApplicationBootstrap() {
    void this.flush();
  }

  /** Da notify(): segna la richiesta in corso; fuori da una richiesta riprova piu' tardi. */
  requestFlush(): void {
    if (!markPushPending()) {
      this.flushLater();
    }
  }

  flushLater(): void {
    setTimeout(() => void this.flush(), LATE_FLUSH_DELAY_MS).unref();
  }

  /**
   * Un giro alla volta: se ne viene chiesto un altro mentre gira, si ripete
   * alla fine. Non lancia mai: un problema delle push non tocca le azioni.
   */
  flush(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async loop() {
    do {
      this.again = false;
      try {
        await this.flushOnce();
      } catch (error) {
        this.logger.error(`Invio delle push non riuscito: ${error instanceof Error ? error.message : error}`);
      }
    } while (this.again);
  }

  private async flushOnce() {
    const now = new Date();
    // Prese e segnate in un'unica UPDATE: due giri (o due server) non mandano
    // la stessa push due volte. Le righe di una transazione ancora aperta non
    // si vedono, quindi non partono mai prima del commit.
    const claimed = await this.prisma.notification.updateManyAndReturn({
      where: { pushedAt: null },
      data: { pushedAt: now },
      select: { id: true, type: true, createdDate: true },
    });
    if (!this.sender.enabled) {
      return;
    }
    const oldest = now.getTime() - MAX_AGE_MS;
    const ids = claimed
      .filter((n) => PUSH_TYPES.includes(n.type as never) && n.createdDate.getTime() >= oldest)
      .map((n) => n.id);
    if (ids.length === 0) {
      return;
    }

    const rows = await this.prisma.notification.findMany({
      where: { id: { in: ids } },
      select: PUSH_SELECT,
    });
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: { in: [...new Set(rows.map((row) => row.user.id))] } },
    });

    const gone = new Set<number>();
    await Promise.all(
      rows.flatMap((row) =>
        devices
          .filter((device) => device.userId === row.user.id)
          .map(async (device) => {
            const locale = pushLocale(device.locale);
            const message = pushMessage(toSource(row), row.user.publicId, locale);
            if (!message) {
              return;
            }
            const result = await this.sender.send(device, webPushPayload(message, locale), row.user.publicId);
            if (result === 'gone') {
              gone.add(device.id);
            }
          }),
      ),
    );
    if (gone.size > 0) {
      await this.prisma.pushDevice.deleteMany({ where: { id: { in: [...gone] } } });
    }
  }
}

function toSource(row: PushRow): PushSource {
  return {
    type: row.type,
    actor: row.actor,
    expense: row.expense && {
      publicId: row.expense.publicId,
      description: row.expense.description,
      amount: row.expense.amount.toString(),
      currency: row.expense.currency,
      categorySlug: row.expense.category?.slug ?? null,
    },
    group: row.group,
    settlement: row.settlement && {
      amount: row.settlement.amount.toString(),
      currency: row.settlement.currency,
      to: row.settlement.to,
    },
  };
}
