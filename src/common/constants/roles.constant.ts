/**
 * Role Constants — Single source of truth untuk semua role string di aplikasi.
 *
 * Digunakan untuk menggantikan hardcoded string role di guards, decorators,
 * controllers, dan service. Jika role baru ditambahkan, tambahkan di sini.
 *
 * @example
 * ```ts
 * import { ROLES } from '../common/constants/roles.constant';
 * @Roles(ROLES.SUPER_ADMIN)
 * ```
 */

export const ROLES = {
  /** Platform-level super admin (developer/pemilik platform) */
  SUPER_ADMIN: 'SUPER_ADMIN',
  /** Tenant owner — terhubung via TenantMember */
  OWNER: 'OWNER',
} as const;

export type RoleConstant = (typeof ROLES)[keyof typeof ROLES];
