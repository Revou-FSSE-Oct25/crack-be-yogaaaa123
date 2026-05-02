export interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
  tenantId: string;
  isSuperAdmin?: boolean;
}
