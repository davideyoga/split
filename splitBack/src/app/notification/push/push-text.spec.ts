import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatAmount,
  PUSH_TEXTS,
  PUSH_TITLE,
  PushLocale,
  pushLocale,
  pushMessage,
  PushSource,
  webPushPayload,
} from './push-text';

// Spazio non separabile, quello che Intl mette fra cifra e simbolo in italiano.
const NBSP = ' ';

const ME = 'me-public-id';
const OTHER = 'other-public-id';

function source(overrides: Partial<PushSource>): PushSource {
  return {
    type: 'EXPENSE_ADDED',
    actor: { nickName: 'Pippo' },
    expense: null,
    group: null,
    settlement: null,
    ...overrides,
  };
}

const dinner = {
  publicId: 'expense-1',
  description: 'Cena',
  amount: '30',
  currency: 'EUR',
  categorySlug: 'food',
};

describe('testi uguali a quelli della campanella', () => {
  // Le stesse chiavi del frontend: se qualcuno cambia una frase in un posto
  // solo, questo test lo dice.
  const frontendI18n = (lang: PushLocale) =>
    JSON.parse(
      readFileSync(join(__dirname, '../../../../../splitFront/src/assets/i18n', `${lang}.json`), 'utf8'),
    ) as Record<string, unknown>;

  for (const lang of ['it', 'en'] as const) {
    it(`${lang}: ogni testo coincide con il suo in ${lang}.json`, () => {
      const json = frontendI18n(lang);
      for (const [key, text] of Object.entries(PUSH_TEXTS[lang])) {
        const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], json);
        expect({ key, text: value }).toEqual({ key, text });
      }
    });
  }
});

describe('pushMessage', () => {
  it('EXPENSE_ADDED: chi, cosa, quanto, nella lingua del dispositivo, e apre la spesa', () => {
    expect(pushMessage(source({ expense: dinner }), ME, 'it')).toEqual({
      title: PUSH_TITLE,
      body: `Pippo ti ha aggiunto a “Cena” (30,00${NBSP}€)`,
      url: '/tabs/activity/expense/expense-1',
    });
    expect(pushMessage(source({ expense: dinner }), ME, 'en')?.body).toBe(
      'Pippo added you to “Cena” (€30.00)',
    );
  });

  it('spesa senza descrizione: lo stesso testo di ripiego delle liste', () => {
    const untitled = { ...dinner, description: '' };
    expect(pushMessage(source({ expense: untitled }), ME, 'it')?.body).toBe(
      `Pippo ti ha aggiunto a “Spesa senza descrizione” (30,00${NBSP}€)`,
    );
    const smartSplit = { ...untitled, categorySlug: 'smart-split' };
    expect(pushMessage(source({ expense: smartSplit }), ME, 'en')?.body).toBe(
      'Pippo added you to “Smart split” (€30.00)',
    );
  });

  it('chi agisce: "Qualcuno" se non c\'e\' piu\', "Utente eliminato" se ha cancellato l\'account', () => {
    expect(pushMessage(source({ actor: null, expense: dinner }), ME, 'it')?.body).toMatch(/^Qualcuno ti ha/);
    const deleted = { nickName: '~deleted~0b6f3a52-6a51-4cf7-9a8a-2d3c5c8a9f10' };
    expect(pushMessage(source({ actor: deleted, expense: dinner }), ME, 'en')?.body).toMatch(
      /^Deleted user added you/,
    );
  });

  it('SETTLEMENT_ADDED: il testo dipende da chi ha dato a chi, e apre i Saldi', () => {
    const toMe = { amount: '15.5', currency: 'EUR', to: { publicId: ME } };
    const fromMe = { ...toMe, to: { publicId: OTHER } };
    expect(pushMessage(source({ type: 'SETTLEMENT_ADDED', settlement: toMe }), ME, 'it')).toEqual({
      title: PUSH_TITLE,
      body: `Pippo ha registrato un rimborso di 15,50${NBSP}€ a tuo favore`,
      url: '/tabs/balances',
    });
    expect(pushMessage(source({ type: 'SETTLEMENT_ADDED', settlement: fromMe }), ME, 'en')?.body).toBe(
      'Pippo recorded that you paid them €15.50',
    );
  });

  it('GROUP_JOINED: apre il gruppo', () => {
    const group = { publicId: 'group-1', name: 'Lisbona' };
    expect(pushMessage(source({ type: 'GROUP_JOINED', group }), ME, 'it')).toEqual({
      title: PUSH_TITLE,
      body: 'Pippo ora fa parte del gruppo “Lisbona”',
      url: '/tabs/groups/group-1',
    });
  });

  it('i tipi esclusi e le notifiche senza la loro spesa non diventano push', () => {
    expect(pushMessage(source({ type: 'EXPENSE_UPDATED', expense: dinner }), ME, 'it')).toBeNull();
    expect(pushMessage(source({ type: 'EXPENSE_DELETED', expense: dinner }), ME, 'it')).toBeNull();
    expect(pushMessage(source({ type: 'EXPENSE_ADDED', expense: null }), ME, 'it')).toBeNull();
    expect(pushMessage(source({ type: 'SOMETHING_NEW' }), ME, 'it')).toBeNull();
  });
});

describe('formatAmount', () => {
  it('come formatMoney del frontend', () => {
    expect(formatAmount('1000', 'EUR', 'it')).toBe(`1000,00${NBSP}€`);
    expect(formatAmount('1000', 'EUR', 'en')).toBe('€1,000.00');
    expect(formatAmount('0.5', 'EUR', 'en')).toBe('€0.50');
  });
});

describe('pushLocale', () => {
  it('italiano solo se e\' "it", altrimenti inglese', () => {
    expect(pushLocale('it')).toBe('it');
    expect(pushLocale('en')).toBe('en');
    expect(pushLocale('fr')).toBe('en');
    expect(pushLocale(null)).toBe('en');
  });
});

describe('webPushPayload', () => {
  it('nel formato del service worker di Angular, con l\'indirizzo da aprire al tocco', () => {
    const payload = JSON.parse(
      webPushPayload({ title: 'Split', body: 'Ciao', url: '/tabs/balances' }, 'it'),
    );
    expect(payload).toEqual({
      notification: {
        title: 'Split',
        body: 'Ciao',
        icon: '/icons/icon-192.png',
        lang: 'it',
        data: {
          url: '/tabs/balances',
          onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '/tabs/balances' } },
        },
      },
    });
  });
});
