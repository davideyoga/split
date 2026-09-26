import { User } from './user.model';

// Rimborso fra due utenti: `from` ha dato `amount` a `to`. Non appartiene a
// nessun gruppo: azzera il saldo complessivo fra i due (tab Saldi).
export interface Settlement {
  publicId: string;
  // Decimal serializzato come stringa (es. "15", "12.5"): passa da toCents().
  amount: string;
  currency: string;
  note: string | null;
  createdDate: string;
  from: User;
  to: User;
  createdBy: User;
}
