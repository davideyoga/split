/**
 * Contatore a finestra fissa, in memoria: al massimo `max` richieste ogni
 * `windowMs` per chiave. Senza dipendenze e senza Nest, per i test Jest.
 *
 * In memoria come il rate limit di Better Auth e quello della ricerca utenti:
 * si azzera a ogni riavvio e vale per un solo processo (TODO.md).
 */
export interface RateRule {
  // Distingue i contatori di regole diverse per la stessa persona.
  name: string;
  max: number;
  windowMs: number;
}

const SWEEP_INTERVAL_MS = 60_000;

export class FixedWindowLimiter {
  private readonly windows = new Map<string, { start: number; count: number; windowMs: number }>();
  private lastSweep = 0;

  /**
   * Conta una richiesta di `subject` per `rule`. Restituisce 0 se passa,
   * altrimenti fra quanti secondi si riapre la finestra. Anche una richiesta
   * rifiutata conta: chi insiste non ottiene nulla.
   */
  hit(subject: string, rule: RateRule, now = Date.now()): number {
    this.sweep(now);
    const key = `${rule.name}:${subject}`;
    let window = this.windows.get(key);
    if (!window || now - window.start >= window.windowMs) {
      window = { start: now, count: 0, windowMs: rule.windowMs };
      this.windows.set(key, window);
    }
    window.count++;
    if (window.count <= rule.max) {
      return 0;
    }
    return Math.max(1, Math.ceil((window.start + window.windowMs - now) / 1000));
  }

  /** Quante finestre sono in memoria (per i test). */
  get size(): number {
    return this.windows.size;
  }

  // Al massimo una volta al minuto: la mappa non cresce senza limite, e non si
  // scorre a ogni richiesta.
  private sweep(now: number) {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) {
      return;
    }
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (now - window.start >= window.windowMs) {
        this.windows.delete(key);
      }
    }
  }
}
