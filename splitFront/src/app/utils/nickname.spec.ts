import { isDeletedNickname, nicknameError } from './nickname';

// Stessa tabella di splitBack/src/app/user/nickname.spec.ts: le due copie
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
  ['~deleted~abcd', 'NICKNAME_INVALID_CHAR'],
];

describe('nicknameError', () => {
  it.each(CASES)('%s -> %s', (nickName, expected) => {
    expect(nicknameError(nickName)).toBe(expected);
  });
});

describe('isDeletedNickname', () => {
  it('riconosce solo gli account cancellati', () => {
    expect(isDeletedNickname('~deleted~1234')).toBe(true);
    expect(isDeletedNickname('deleted.user')).toBe(false);
    expect(isDeletedNickname(null)).toBe(false);
  });
});
