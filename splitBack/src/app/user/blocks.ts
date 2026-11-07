import type { Prisma } from '@prisma/client';

/**
 * "Blocca" (2026-11-07, doc/InvitiGruppo.md). Se A blocca B, B:
 * - non trova piu' A con la ricerca ne' fra i contatti;
 * - non puo' mettere A in una spesa (nuova, o modificandone una) ne'
 *   registrare un rimborso con A: riceve lo stesso errore di un utente che
 *   non esiste, cosi' non sa di essere bloccato;
 * - con le sue azioni non manda piu' notifiche ad A.
 * Spese e gruppi gia' in comune restano: i saldi sono debiti veri, e da un
 * gruppo si esce.
 */

// Basta il delegato della tabella: va bene sia PrismaService sia una
// transazione.
type BlockReader = Pick<Prisma.TransactionClient, 'userBlock'>;

/** Fra `userIds`, chi ha bloccato `actorId`. */
export async function blockersOf(db: BlockReader, actorId: number, userIds: number[]): Promise<Set<number>> {
  const ids = [...new Set(userIds)].filter((id) => id !== actorId);
  if (ids.length === 0) {
    return new Set();
  }
  const rows = await db.userBlock.findMany({
    where: { blockedId: actorId, blockerId: { in: ids } },
    select: { blockerId: true },
  });
  return new Set(rows.map((row) => row.blockerId));
}

/**
 * Chi controllare quando `actorId` mette delle persone in una spesa: solo chi
 * entra adesso. Chi c'era gia' (una spesa in comune da prima del blocco) si
 * puo' ancora modificare, e chi agisce non conta.
 */
export function newcomers(actorId: number, participantIds: number[], alreadyInIds: number[]): number[] {
  const already = new Set(alreadyInIds);
  return [...new Set(participantIds)].filter((id) => id !== actorId && !already.has(id));
}

/** I destinatari di una notifica, tolti quelli che hanno bloccato chi agisce. */
export function withoutBlockers(recipientIds: number[], blockerIds: Set<number>): number[] {
  return recipientIds.filter((id) => !blockerIds.has(id));
}
