export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',

  OWNER: 'OWNER',
} as const;

export type RoleConstant = (typeof ROLES)[keyof typeof ROLES];
