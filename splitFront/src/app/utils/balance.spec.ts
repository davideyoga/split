import { User } from '../models/user.model';
import { computeBalances, toCents } from './balance';
import { isEqualSplit, splitEqually } from './split';

const me: User = { publicId: 'me', nickName: 'Davide' };
const pippo: User = { publicId: 'pippo', nickName: 'Pippo' };
const pluto: User = { publicId: 'pluto', nickName: 'Pluto' };

describe('toCents', () => {
  it('legge i Decimal serializzati come stringhe', () => {
    expect(toCents('10.5')).toBe(1050);
    expect(toCents('0.1')).toBe(10);
    expect(toCents(null)).toBe(0);
    expect(toCents('abc')).toBe(0);
  });
});

describe('computeBalances', () => {
  it('il credito di chi paga e\' la somma delle quote degli altri', () => {
    // 10 EUR in tre, arrotondati uno per uno come le righe di prima del 2026-09-26.
    const summary = computeBalances(
      [
        {
          paidBy: me,
          expenseContributions: [
            { share: '3.33', user: me },
            { share: '3.33', user: pippo },
            { share: '3.33', user: pluto },
          ],
        },
      ],
      me.publicId,
    );
    expect(summary.owedToMeCents).toBe(666);
    expect(summary.iOweCents).toBe(0);
    expect(summary.balances.map((b) => [b.user.publicId, b.cents])).toEqual([
      ['pippo', 333],
      ['pluto', 333],
    ]);
  });

  it('un rimborso conta come una spesa pagata da chi da\'', () => {
    const summary = computeBalances(
      [{ paidBy: pippo, expenseContributions: [{ share: '20', user: me }, { share: '0', user: pippo }] }],
      me.publicId,
      [{ from: me, to: pippo, amount: '15' }],
    );
    expect(summary.netCents).toBe(-500);
  });

  it('ignora i debiti fra altre persone', () => {
    const summary = computeBalances(
      [{ paidBy: pippo, expenseContributions: [{ share: '5', user: pluto }, { share: '5', user: pippo }] }],
      me.publicId,
    );
    expect(summary.balances).toEqual([]);
  });
});

describe('splitEqually', () => {
  it('da\' i centesimi di resto ai primi, e la somma torna', () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqually(1000, 0)).toEqual([]);
  });

  it('una divisione equa resta equa anche col centesimo di resto', () => {
    expect(isEqualSplit([334, 333, 333])).toBe(true);
    expect(isEqualSplit([500, 300, 200])).toBe(false);
  });
});
