import { nicknameError, normalizeNickname } from './nickname';

// Stessa tabella di splitFront/src/app/utils/nickname.spec.ts: le due copie
// delle regole devono dare lo stesso risultato.
const CASES: [string, ReturnType<typeof nicknameError>][] = [
  ['Pippo', null],
  ['Pip.po-7', null],
  ['Ugo', 'NICKNAME_TOO_SHORT'],
  ['a'.repeat(21), 'NICKNAME_TOO_LONG'],
  ['Nicolò', 'NICKNAME_INVALID_CHAR'],
  ['Pip po', 'NICKNAME_INVALID_CHAR'],
  ['.Pippo', 'NICKNAME_EDGE'],
  ['Pippo-', 'NICKNAME_EDGE'],
  ['Pip..po', 'NICKNAME_DOUBLE_SEPARATOR'],
  ['Pip.-po', 'NICKNAME_DOUBLE_SEPARATOR'],
];

describe('nicknameError', () => {
  it.each(CASES)('%s -> %s', (nickName, expected) => {
    expect(nicknameError(nickName)).toBe(expected);
  });

  it('il carattere non valido vince sulla lunghezza', () => {
    expect(nicknameError('ò')).toBe('NICKNAME_INVALID_CHAR');
  });
});

describe('normalizeNickname', () => {
  it('toglie solo gli spazi ai lati', () => {
    expect(normalizeNickname('  Pip.po ')).toBe('Pip.po');
  });
});
