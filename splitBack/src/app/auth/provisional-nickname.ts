import { randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { NICKNAME_MAX_LENGTH, nicknameError } from '../user/nickname';

/**
 * Nickname provvisorio di chi si registra da solo (codice via email, Google o
 * Apple), finche' non ne sceglie uno su /welcome. `User.nickName` e'
 * obbligatorio e unico, quindi l'insert ne vuole uno valido subito.
 *
 * Dal nome che manda Google/Apple ("Mario Rossi" -> "Mario.Rossi") se rispetta
 * le regole di nickname.ts ed e' libero: /welcome lo propone. Altrimenti, e
 * per chi entra col codice (nome vuoto), `user` + 8 cifre casuali, che
 * /welcome non propone (PLACEHOLDER_NICKNAME nel frontend).
 *
 * Il controllo "libero" e' un findUnique prima dell'insert: due registrazioni
 * simultanee con lo stesso nome possono passarlo entrambe, e la seconda fallisce
 * sul vincolo unico (P2002). Raro, e basta riprovare.
 */
export async function provisionalNickname(prisma: PrismaClient, name: string | null | undefined): Promise<string> {
  const fromName = nicknameFromName(name ?? '');
  if (fromName && !(await isTaken(prisma, fromName))) {
    return fromName;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `user${randomInt(10_000_000, 100_000_000)}`;
    if (!(await isTaken(prisma, candidate))) {
      return candidate;
    }
  }
  throw new Error('Nessun nickname provvisorio libero dopo 5 tentativi');
}

/**
 * "José María Pérez" -> "Jose.Maria.Perez": accenti tolti, spazi -> `.`, via
 * gli altri caratteri non ammessi, tagliato a 20. `null` se non ne esce un
 * nickname valido (troppo corto, nome vuoto, solo caratteri di altri alfabeti).
 */
export function nicknameFromName(name: string): string | null {
  const candidate = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_]+/g, '.')
    .replace(/[^A-Za-z0-9.-]/g, '')
    .replace(/[.-]{2,}/g, (run) => run[0])
    .slice(0, NICKNAME_MAX_LENGTH)
    .replace(/^[.-]+|[.-]+$/g, '');
  return nicknameError(candidate) === null ? candidate : null;
}

async function isTaken(prisma: PrismaClient, nickName: string): Promise<boolean> {
  // citext: il confronto ignora le maiuscole, come il vincolo unico.
  return (await prisma.user.findUnique({ where: { nickName }, select: { id: true } })) !== null;
}
