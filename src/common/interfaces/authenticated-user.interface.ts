import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: Role;
}
