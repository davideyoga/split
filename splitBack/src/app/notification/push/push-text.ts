import { DELETED_NICKNAME_PREFIX } from '../../user/nickname';
import type { NotificationType } from '../notification.types';

/**
 * Testo e destinazione delle push (doc/NotifichePush.md). Come l'email del
 * codice, e' testo generato dal server: le frasi stanno qui, nella lingua del
 * dispositivo che la riceve, e non si salvano mai nel DB.
 *
 * Sono le stesse frasi della campanella: ogni chiave e' quella del frontend
 * (splitFront/src/assets/i18n/*.json), e push-text.spec.ts controlla che i
 * testi coincidano. Cambiare una frase vuol dire cambiarla in entrambi i posti.
 */
export type PushLocale = 'it' | 'en';

/**
 * I tipi che diventano una push (decisione dell'utente, 2026-11-12). Gli altri
 * restano solo nella campanella: una modifica, o una spesa da cui si e' tolti,
 * non vale un avviso sul telefono.
 */
export const PUSH_TYPES: readonly NotificationType[] = [
  'EXPENSE_ADDED',
  'SETTLEMENT_ADDED',
  'GROUP_JOINED',
];

// Il titolo: la frase e' tutta nel corpo. Se l'app cambia nome, va cambiato qui.
export const PUSH_TITLE = 'Split';

const TEXTS = {
  it: {
    'notifications.someone': 'Qualcuno',
    'common.deleted-user': 'Utente eliminato',
    'expense-detail.untitled': 'Spesa senza descrizione',
    'categories.smart-split': 'Divisione intelligente',
    'notifications.type.EXPENSE_ADDED': '{{actor}} ti ha aggiunto a “{{description}}” ({{amount}})',
    'notifications.type.SETTLEMENT_ADDED_TO_ME': '{{actor}} ha registrato un rimborso di {{amount}} a tuo favore',
    'notifications.type.SETTLEMENT_ADDED_FROM_ME': '{{actor}} ha registrato un tuo rimborso di {{amount}}',
    'notifications.type.GROUP_JOINED': '{{actor}} ora fa parte del gruppo “{{group}}”',
  },
  en: {
    'notifications.someone': 'Someone',
    'common.deleted-user': 'Deleted user',
    'expense-detail.untitled': 'Untitled expense',
    'categories.smart-split': 'Smart split',
    'notifications.type.EXPENSE_ADDED': '{{actor}} added you to “{{description}}” ({{amount}})',
    'notifications.type.SETTLEMENT_ADDED_TO_ME': '{{actor}} recorded that they paid you {{amount}}',
    'notifications.type.SETTLEMENT_ADDED_FROM_ME': '{{actor}} recorded that you paid them {{amount}}',
    'notifications.type.GROUP_JOINED': '{{actor}} joined the group “{{group}}”',
  },
} as const satisfies Record<PushLocale, Record<string, string>>;

export type PushTextKey = keyof (typeof TEXTS)['it'];

/** Per il test di parita' con i file del frontend. */
export const PUSH_TEXTS: Record<PushLocale, Record<PushTextKey, string>> = TEXTS;

const SMART_SPLIT_SLUG = 'smart-split';

/** I dati di una notifica che servono alla push (come la riga della campanella). */
export interface PushSource {
  type: string;
  actor: { nickName: string } | null;
  expense: {
    publicId: string;
    description: string;
    amount: string;
    currency: string;
    categorySlug: string | null;
  } | null;
  group: { publicId: string; name: string } | null;
  settlement: { amount: string; currency: string; to: { publicId: string } } | null;
}

export interface PushMessage {
  title: string;
  body: string;
  // Percorso dell'app da aprire al tocco, come i link della pagina Notifiche.
  url: string;
}

export function pushLocale(value: string | null | undefined): PushLocale {
  return value === 'it' ? 'it' : 'en';
}

/**
 * La push di una notifica, o null se non ne merita una (tipo escluso) o se le
 * manca quello di cui parla (non dovrebbe succedere: le FK sono in cascata).
 */
export function pushMessage(
  source: PushSource,
  recipientPublicId: string,
  locale: PushLocale,
): PushMessage | null {
  const t = TEXTS[locale];
  const actor = actorName(source.actor, locale);

  switch (source.type) {
    case 'EXPENSE_ADDED': {
      const expense = source.expense;
      if (!expense) {
        return null;
      }
      const description =
        expense.description ||
        (expense.categorySlug === SMART_SPLIT_SLUG
          ? t['categories.smart-split']
          : t['expense-detail.untitled']);
      return {
        title: PUSH_TITLE,
        body: fill(t['notifications.type.EXPENSE_ADDED'], {
          actor,
          description,
          amount: formatAmount(expense.amount, expense.currency, locale),
        }),
        url: `/tabs/activity/expense/${expense.publicId}`,
      };
    }
    case 'SETTLEMENT_ADDED': {
      const settlement = source.settlement;
      if (!settlement) {
        return null;
      }
      const key =
        settlement.to.publicId === recipientPublicId
          ? 'notifications.type.SETTLEMENT_ADDED_TO_ME'
          : 'notifications.type.SETTLEMENT_ADDED_FROM_ME';
      return {
        title: PUSH_TITLE,
        body: fill(t[key], {
          actor,
          amount: formatAmount(settlement.amount, settlement.currency, locale),
        }),
        url: '/tabs/balances',
      };
    }
    case 'GROUP_JOINED': {
      const group = source.group;
      if (!group) {
        return null;
      }
      return {
        title: PUSH_TITLE,
        body: fill(t['notifications.type.GROUP_JOINED'], { actor, group: group.name }),
        url: `/tabs/groups/${group.publicId}`,
      };
    }
    default:
      return null;
  }
}

/**
 * Il contenuto di una Web Push nel formato del service worker di Angular
 * (ngsw-worker.js): mostra `notification` e, al tocco, porta in primo piano
 * l'app se e' aperta (che poi naviga su `data.url`, vedi PushService nel
 * frontend) oppure la apre direttamente su quell'indirizzo.
 */
export function webPushPayload(message: PushMessage, locale: PushLocale): string {
  return JSON.stringify({
    notification: {
      title: message.title,
      body: message.body,
      icon: '/icons/icon-192.png',
      lang: locale,
      data: {
        url: message.url,
        onActionClick: {
          default: { operation: 'focusLastFocusedOrOpen', url: message.url },
        },
      },
    },
  });
}

// Come la pipe userName del frontend: un account cancellato non mostra il
// nickname casuale che gli resta.
function actorName(actor: { nickName: string } | null, locale: PushLocale): string {
  if (!actor) {
    return TEXTS[locale]['notifications.someone'];
  }
  if (actor.nickName.startsWith(DELETED_NICKNAME_PREFIX)) {
    return TEXTS[locale]['common.deleted-user'];
  }
  return actor.nickName;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => values[name] ?? match);
}

/**
 * Come formatMoney del frontend (utils/money.ts): "84,50 €" in italiano,
 * "€84.50" in inglese. `amount` e' il Decimal di Prisma come stringa.
 */
export function formatAmount(amount: string, currency: string, locale: PushLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
