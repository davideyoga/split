/**
 * Regole del nickname: copia gemella di splitBack/src/app/user/nickname.ts,
 * che e' quella che fa fede (qui servono solo per il messaggio mentre si
 * scrive). Se ne cambi una, cambia anche l'altra. Motivazioni delle regole:
 * vedi il file del backend e CLAUDE.md, "Nickname".
 */
export const NICKNAME_MIN_LENGTH = 5;
export const NICKNAME_MAX_LENGTH = 20;

const ALLOWED_CHAR = /^[A-Za-z0-9.-]$/;
const SEPARATOR = /^[.-]$/;

export type NicknameError =
  | 'NICKNAME_TOO_SHORT'
  | 'NICKNAME_TOO_LONG'
  | 'NICKNAME_INVALID_CHAR'
  | 'NICKNAME_EDGE'
  | 'NICKNAME_DOUBLE_SEPARATOR';

/** Il nickname come lo si salva: solo gli spazi ai lati tolti. */
export function normalizeNickname(value: string): string {
  return value.trim();
}

/**
 * `null` se il nickname (gia' normalizzato) rispetta le regole, altrimenti la
 * prima regola violata.
 */
export function nicknameError(nickName: string): NicknameError | null {
  // Prima i caratteri: e' l'errore da correggere comunque, e dopo questo
  // controllo la stringa e' solo ASCII, quindi `length` conta proprio i
  // caratteri (un'emoji ne varrebbe due).
  if (invalidNicknameChar(nickName) !== null) {
    return 'NICKNAME_INVALID_CHAR';
  }
  if (nickName.length < NICKNAME_MIN_LENGTH) {
    return 'NICKNAME_TOO_SHORT';
  }
  if (nickName.length > NICKNAME_MAX_LENGTH) {
    return 'NICKNAME_TOO_LONG';
  }
  if (SEPARATOR.test(nickName[0]) || SEPARATOR.test(nickName[nickName.length - 1])) {
    return 'NICKNAME_EDGE';
  }
  if (/[.-]{2}/.test(nickName)) {
    return 'NICKNAME_DOUBLE_SEPARATOR';
  }
  return null;
}

/** Il primo carattere non ammesso (un code point intero, anche un'emoji), o `null`. */
export function invalidNicknameChar(nickName: string): string | null {
  return [...nickName].find((c) => !ALLOWED_CHAR.test(c)) ?? null;
}
