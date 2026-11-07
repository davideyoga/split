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
  // Qualcuno ti ha messo in un gruppo. Non si crea piu' (dal 2026-11-07 nei
  // gruppi si entra solo col link), ma le righe vecchie restano.
  | 'GROUP_ADDED'
  // Qualcuno e' entrato col link in un gruppo di cui fai parte.
  | 'GROUP_JOINED'
  // L'altra persona ha registrato un rimborso fra voi due.
  | 'SETTLEMENT_ADDED';

/** `params` di EXPENSE_REMOVED / EXPENSE_DELETED: la spesa com'era. */
// `type` e non `interface`: solo cosi' TypeScript lo accetta come JSON di Prisma.
export type ExpenseSnapshot = {
  description: string;
  amount: string;
  currency: string;
  categorySlug: string | null;
};
