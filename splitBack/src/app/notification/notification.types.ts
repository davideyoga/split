/**
 * Tipi di notifica (colonna `Notification.type`). Il frontend li traduce
 * come `notifications.type.<TYPE>`: aggiungerne uno vuol dire toccare anche
 * splitFront/src/app/models/notification.model.ts e le due lingue.
 *
 * Niente enum, come in nickname.ts.
 */
export type NotificationType =
  // Qualcuno ti ha messo in una spesa (alla creazione o a una modifica).
  | 'EXPENSE_ADDED'
  // Qualcuno ha cambiato una spesa in cui eri gia'.
  | 'EXPENSE_UPDATED'
  // Qualcuno ti ha tolto da una spesa: istantanea in `params`.
  | 'EXPENSE_REMOVED'
  // Qualcuno ha eliminato una spesa in cui eri: istantanea in `params`.
  | 'EXPENSE_DELETED'
  // Qualcuno ti ha messo in un gruppo.
  | 'GROUP_ADDED'
  // L'altra persona ha registrato un rimborso fra voi due.
  | 'SETTLEMENT_ADDED'
  // Amici e richieste (2026-10-25):
  // chi non e' ancora tuo amico ti ha messo in una spesa: accetta o rifiuta.
  | 'EXPENSE_PENDING'
  // chi avevi messo in una spesa l'ha rifiutata: la sua quota e' passata a te.
  | 'EXPENSE_REJECTED'
  // ha accettato la tua richiesta: ora siete amici.
  | 'FRIEND_ACCEPTED'
  // chi non e' ancora tuo amico ti ha invitato in un gruppo.
  | 'GROUP_INVITED'
  // ha accettato il tuo invito nel gruppo.
  | 'GROUP_JOINED'
  // ha rifiutato il tuo invito nel gruppo.
  | 'GROUP_DECLINED';

/** `params` di EXPENSE_REMOVED / EXPENSE_DELETED: la spesa com'era. */
// `type` e non `interface`: solo cosi' TypeScript lo accetta come JSON di Prisma.
export type ExpenseSnapshot = {
  description: string;
  amount: string;
  currency: string;
  categorySlug: string | null;
};
