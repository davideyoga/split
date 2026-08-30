import { User } from './user.model';

export interface Group {
  publicId: string;
  name: string;
  members: User[];
}
