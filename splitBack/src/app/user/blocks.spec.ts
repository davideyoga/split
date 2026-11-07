import { blockersOf, newcomers, withoutBlockers } from './blocks';

describe('newcomers', () => {
  it('solo chi entra adesso, senza chi agisce e senza doppioni', () => {
    expect(newcomers(1, [1, 2, 3, 3, 4], [3])).toEqual([2, 4]);
  });

  it('una spesa che resta con le stesse persone non controlla nessuno', () => {
    expect(newcomers(1, [2, 3], [1, 2, 3])).toEqual([]);
  });
});

describe('withoutBlockers', () => {
  it('toglie chi ha bloccato chi agisce', () => {
    expect(withoutBlockers([2, 3, 4], new Set([3]))).toEqual([2, 4]);
  });
});

describe('blockersOf', () => {
  it('chiede al DB solo chi puo\' averlo bloccato', async () => {
    const findMany = jest.fn().mockResolvedValue([{ blockerId: 3 }]);
    const db = { userBlock: { findMany } } as unknown as Parameters<typeof blockersOf>[0];

    expect(await blockersOf(db, 1, [1, 2, 3, 3])).toEqual(new Set([3]));
    expect(findMany).toHaveBeenCalledWith({
      where: { blockedId: 1, blockerId: { in: [2, 3] } },
      select: { blockerId: true },
    });
  });

  it('senza nessuno da controllare non interroga il DB', async () => {
    const findMany = jest.fn();
    const db = { userBlock: { findMany } } as unknown as Parameters<typeof blockersOf>[0];

    expect(await blockersOf(db, 1, [1])).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });
});
