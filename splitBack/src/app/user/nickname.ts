/**
 * Regole del nickname (rename dal Profilo, add-users.mts, check-nicknames.mts).
 *
 * Copia gemella in splitFront/src/app/utils/nickname.ts: il frontend le usa
 * per il messaggio mentre si scrive, il backend e' quello che fa fede. Se ne
 * cambi una, cambia anche l'altra. Non stanno in data-access/ perche' oggi
 * nessuno dei due progetti lo importa e il bundle webpack del backend lo
 * lascerebbe come `require()` di un file .ts.
 *
 * Solo ASCII: cosi' il confronto senza maiuscole (colonna citext) non ha casi
 * ambigui e non si possono imitare nickname con lettere simili di altri
 * alfabeti. `.` e `-` solo in mezzo e mai doppi: niente `..` (segmenti di
 * path), niente `-` iniziale (formula injection nei CSV, opzioni da riga di
 * comando). Vedi CLAUDE.md, "Nickname".
 *
 * Niente enum: il file lo importano anche script lanciati con `node`, che
 * toglie i tipi ma non traduce le enum.
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
