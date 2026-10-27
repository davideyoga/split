import { User } from './user.model';

export interface Group {
  publicId: string;
  name: string;
  // Solo chi ha accettato: e' chi entra nelle spese del gruppo.
  members: User[];
  // Invitati che non hanno ancora accettato (2026-10-25).
  invited?: User[];
}
