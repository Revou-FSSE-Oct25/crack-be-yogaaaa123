import { SetMetadata } from '@nestjs/common';
import { TenantRole } from '@prisma/client';
import { ROLES } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (TenantRole | typeof ROLES.SUPER_ADMIN)[]) =>
  SetMetadata(ROLES_KEY, roles);
