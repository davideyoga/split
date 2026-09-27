import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Dove finiscono le email, scelto da MAIL_TRANSPORT:
 * - `brevo`: API transazionale di Brevo (BREVO_API_KEY, MAIL_FROM);
 * - `console` (default): stampa l'email nel log del server, per lo sviluppo;
 * - `outbox`: scrive l'ultima email di ogni destinatario in MAIL_OUTBOX_DIR,
 *   da cui la leggono i test e2e.
 * Non dipende da nulla dell'app: si copia cosi' com'e' in un altro progetto Nest.
 */
type Transport = 'brevo' | 'console' | 'outbox';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transport;

  constructor() {
    const transport = process.env['MAIL_TRANSPORT'] || 'console';
    if (transport !== 'brevo' && transport !== 'console' && transport !== 'outbox') {
      throw new Error(`MAIL_TRANSPORT non valido: "${transport}" (brevo | console | outbox)`);
    }
    this.transport = transport;

    // Configurazione mancante = errore all'avvio, non alla prima email.
    if (transport === 'brevo') {
      requireEnv('BREVO_API_KEY');
      requireEnv('MAIL_FROM');
    }
    if (transport === 'outbox') {
      requireEnv('MAIL_OUTBOX_DIR');
    }
    if (transport === 'console') {
      this.logger.warn('MAIL_TRANSPORT=console: le email vengono solo stampate nel log, non inviate.');
    }
  }

  async send(message: MailMessage): Promise<void> {
    switch (this.transport) {
      case 'brevo':
        return this.sendWithBrevo(message);
      case 'outbox':
        return this.writeToOutbox(message);
      case 'console':
        this.logger.log(`Email a ${message.to} — ${message.subject}\n${message.text}`);
        return;
    }
  }

  private async sendWithBrevo(message: MailMessage): Promise<void> {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': requireEnv('BREVO_API_KEY'),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: requireEnv('MAIL_FROM'), name: process.env['MAIL_FROM_NAME'] || 'Split' },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
    });
    if (!response.ok) {
      throw new Error(`Brevo ha risposto ${response.status}: ${await response.text()}`);
    }
  }

  // Un file per destinatario, sovrascritto: i test leggono sempre l'ultima email.
  private async writeToOutbox(message: MailMessage): Promise<void> {
    const dir = requireEnv('MAIL_OUTBOX_DIR');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${encodeURIComponent(message.to)}.json`), JSON.stringify(message));
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente ${name} mancante (vedi .env.example)`);
  }
  return value;
}
