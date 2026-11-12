import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as webpush from 'web-push';

/**
 * Dove finiscono le push, scelto da PUSH_TRANSPORT (doc/NotifichePush.md):
 * - `off` (default): nessuna push. Le notifiche si segnano comunque come
 *   gestite, cosi' riaccendendole non parte la coda accumulata;
 * - `live`: invio vero. Oggi solo Web Push (browser e PWA), con le chiavi
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY e VAPID_SUBJECT; Android (FCM) e iOS
 *   (APNs) si aggiungeranno qui;
 * - `console`: stampa la push nel log del server, per lo sviluppo;
 * - `outbox`: aggiunge la push al file del destinatario in PUSH_OUTBOX_DIR, da
 *   cui la leggono i test e2e.
 * Come in MailService, una configurazione mancante ferma l'avvio.
 */
type Transport = 'off' | 'live' | 'console' | 'outbox';

const TRANSPORTS: readonly Transport[] = ['off', 'live', 'console', 'outbox'];

export interface PushTarget {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

// `gone`: il servizio di consegna dice che l'iscrizione non esiste piu'
// (404/410): il dispositivo va tolto dalla tabella.
export type PushResult = 'sent' | 'gone' | 'failed';

// Un telefono spento per piu' di un giorno non riceve le push vecchie: la
// campanella le ha comunque.
const TTL_SECONDS = 24 * 60 * 60;
const SEND_TIMEOUT_MS = 10_000;

@Injectable()
export class PushSender {
  private readonly logger = new Logger(PushSender.name);
  private readonly transport: Transport;
  // Le scritture dell'outbox in fila: piu' push allo stesso utente leggono e
  // riscrivono lo stesso file.
  private outboxQueue: Promise<void> = Promise.resolve();

  constructor() {
    const transport = process.env['PUSH_TRANSPORT'] || 'off';
    if (!TRANSPORTS.includes(transport as Transport)) {
      throw new Error(`PUSH_TRANSPORT non valido: "${transport}" (${TRANSPORTS.join(' | ')})`);
    }
    this.transport = transport as Transport;

    if (this.transport === 'live') {
      const subject = requireEnv('VAPID_SUBJECT');
      if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
        throw new Error('VAPID_SUBJECT deve iniziare con "mailto:" o "https://"');
      }
      // Controlla anche il formato delle chiavi: un errore qui ferma l'avvio.
      webpush.setVapidDetails(subject, requireEnv('VAPID_PUBLIC_KEY'), requireEnv('VAPID_PRIVATE_KEY'));
    }
    if (this.transport === 'outbox') {
      requireEnv('PUSH_OUTBOX_DIR');
    }
    if (this.transport === 'console') {
      this.logger.warn('PUSH_TRANSPORT=console: le push vengono solo stampate nel log, non inviate.');
    }
  }

  get enabled(): boolean {
    return this.transport !== 'off';
  }

  /**
   * La chiave pubblica VAPID, che il browser usa per iscriversi. null = le
   * push non sono disponibili, e il Profilo non mostra l'interruttore.
   */
  get vapidPublicKey(): string | null {
    return this.enabled ? process.env['VAPID_PUBLIC_KEY'] || null : null;
  }

  async send(target: PushTarget, payload: string, recipientPublicId: string): Promise<PushResult> {
    switch (this.transport) {
      case 'live':
        return this.sendWebPush(target, payload);
      case 'outbox':
        await this.writeToOutbox(target, payload, recipientPublicId);
        return 'sent';
      case 'console':
        this.logger.log(`Push a ${recipientPublicId}: ${payload}`);
        return 'sent';
      case 'off':
        return 'failed';
    }
  }

  private async sendWebPush(target: PushTarget, payload: string): Promise<PushResult> {
    if (!target.p256dh || !target.auth) {
      return 'failed';
    }
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: TTL_SECONDS, timeout: SEND_TIMEOUT_MS, urgency: 'normal' },
      );
      return 'sent';
    } catch (error) {
      if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        return 'gone';
      }
      // Niente endpoint nel log: e' l'indirizzo a cui consegnare le push di
      // quella persona.
      const status = error instanceof webpush.WebPushError ? error.statusCode : 'nessuna risposta';
      this.logger.warn(`Push non consegnata (${status}): ${error instanceof Error ? error.message : error}`);
      return 'failed';
    }
  }

  // Un file per destinatario con tutte le sue push, scritto in un file
  // temporaneo e poi rinominato: i test non leggono mai un file a meta'.
  private writeToOutbox(target: PushTarget, payload: string, recipientPublicId: string): Promise<void> {
    const write = async () => {
      const dir = requireEnv('PUSH_OUTBOX_DIR');
      await mkdir(dir, { recursive: true });
      const file = join(dir, `${encodeURIComponent(recipientPublicId)}.json`);
      let pushes: unknown[] = [];
      try {
        pushes = JSON.parse(await readFile(file, 'utf8')) as unknown[];
      } catch {
        pushes = [];
      }
      pushes.push({ endpoint: target.endpoint, payload: JSON.parse(payload) as unknown });
      await writeFile(`${file}.tmp`, JSON.stringify(pushes));
      await rename(`${file}.tmp`, file);
    };
    const result = this.outboxQueue.then(write, write);
    this.outboxQueue = result.catch(() => undefined);
    return result;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente ${name} mancante (vedi .env.example)`);
  }
  return value;
}
