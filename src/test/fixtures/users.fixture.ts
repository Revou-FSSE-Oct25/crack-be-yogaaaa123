export const TENANT_ID = 'tenant-uuid-1';
export const OTHER_TENANT_ID = 'tenant-uuid-2';

export const ADMIN_USER = {
  id: 'admin-uuid-1',
  username: 'admin1',
  email: 'admin@example.com',
  role: 'ADMIN',
  passwordHash: '',
  displayName: 'Admin Satu',
  tenantId: TENANT_ID,
  failedLoginAttempts: 0,
  lockedUntil: null,
  deletedAt: null,
};

export const STAFF_USER = {
  id: 'staff-uuid-1',
  username: 'staff1',
  email: 'staff@example.com',
  role: 'STAFF',
  passwordHash: '',
  displayName: 'Staff Satu',
  tenantId: TENANT_ID,
  failedLoginAttempts: 0,
  lockedUntil: null,
  deletedAt: null,
};

export const OTHER_TENANT_USER = {
  id: 'other-uuid-1',
  username: 'other_admin',
  email: 'other@example.com',
  role: 'ADMIN',
  passwordHash: '',
  displayName: 'Other Tenant Admin',
  tenantId: OTHER_TENANT_ID,
  failedLoginAttempts: 0,
  lockedUntil: null,
  deletedAt: null,
};

export const LOCKED_USER = {
  id: 'locked-uuid-1',
  username: 'locked_user',
  email: 'locked@example.com',
  role: 'STAFF',
  passwordHash: '',
  displayName: 'Locked User',
  tenantId: TENANT_ID,
  failedLoginAttempts: 5,
  lockedUntil: new Date(Date.now() + 3600000).toISOString(),
  deletedAt: null,
};
