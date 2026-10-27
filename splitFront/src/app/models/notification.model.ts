import { User } from './user.model';

// Tipi di notifica, gemelli di splitBack/src/app/notification/notification.types.ts.
// Ognuno ha il suo testo in `notifications.type.<TYPE>` (i rimborsi due, secondo
// chi ha dato a chi). Un tipo che questa versione dell'app non conosce (backend
// piu' nuovo di una PWA in cache) si mostra con `notifications.type.unknown`.
export type NotificationType =
  | 'EXPENSE_ADDED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_REMOVED'
  | 'EXPENSE_DELETED'
  | 'GROUP_ADDED'
  | 'SETTLEMENT_ADDED'
  | 'EXPENSE_PENDING'
  | 'EXPENSE_REJECTED'
  | 'FRIEND_ACCEPTED'
  | 'GROUP_INVITED'
  | 'GROUP_JOINED'
  | 'GROUP_DECLINED';

// La spesa com'era, per EXPENSE_REMOVED / EXPENSE_DELETED: non si puo' piu' aprire.
export interface ExpenseSnapshot {
  description: string;
  amount: string;
  currency: string;
  categorySlug: string | null;
}

// `AppNotification` e non `Notification`, che e' un tipo globale del DOM.
export interface AppNotification {
  publicId: string;
  type: NotificationType;
  createdDate: string;
  read: boolean;
  actor: User | null;
  expense: {
    publicId: string;
    description: string;
    amount: string;
    currency: string;
    categorySlug: string | null;
  } | null;
  group: { publicId: string; name: string } | null;
  settlement: {
    publicId: string;
    amount: string;
    currency: string;
    from: User;
    to: User;
  } | null;
  params: ExpenseSnapshot | null;
}
