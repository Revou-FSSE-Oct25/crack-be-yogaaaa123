import { createMockPrisma, MockPrismaService } from './mock-prisma';

export { createMockPrisma };
export type { MockPrismaService };

export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-1',
    username: 'admin1',
    email: 'admin@example.com',
    role: 'ADMIN',
    passwordHash: '',
    displayName: 'Admin Satu',
    deletedAt: null,
    tenantId: 'tenant-uuid-1',
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

export function createMockStaff(overrides: Record<string, unknown> = {}) {
  return createMockUser({
    id: 'user-uuid-2',
    username: 'staff1',
    email: 'staff@example.com',
    role: 'STAFF',
    displayName: 'Staff Satu',
    ...overrides,
  });
}

export function createMockProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-uuid-1',
    name: 'Test Product',
    sku: 'TST-001',
    description: 'A test product',
    unitPrice: '100.00',
    averageCost: '60.00',
    stockQuantity: 50,
    reorderLevel: 10,
    categoryId: 'cat-uuid-1',
    supplierId: 'sup-uuid-1',
    tenantId: 'tenant-uuid-1',
    deletedAt: null,
    ...overrides,
  };
}

export function createMockCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-uuid-1',
    name: 'Test Category',
    tenantId: 'tenant-uuid-1',
    deletedAt: null,
    ...overrides,
  };
}

export function createMockSupplier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sup-uuid-1',
    name: 'Test Supplier',
    contactPerson: 'John',
    phone: '08123456789',
    email: 'supplier@example.com',
    tenantId: 'tenant-uuid-1',
    deletedAt: null,
    ...overrides,
  };
}

export function createMockSalesOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-uuid-1',
    orderNumber: 'SO-TEST-001',
    status: 'COMPLETED',
    customerId: 'CUST-001',
    userId: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    totalPrice: '250.00',
    totalCogs: '190.00',
    totalProfit: '60.00',
    deletedAt: null,
    ...overrides,
  };
}

export function createMockPurchaseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-uuid-1',
    orderNumber: 'PO-TEST-001',
    status: 'PENDING',
    supplierId: 'sup-uuid-1',
    userId: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    totalPrice: '500.00',
    deletedAt: null,
    ...overrides,
  };
}

export function createMockReturn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ret-uuid-1',
    salesOrderId: 'so-uuid-1',
    userId: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    totalRefund: '50.00',
    reason: 'Damaged goods',
    deletedAt: null,
    ...overrides,
  };
}

export function createMockStockTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'st-uuid-1',
    productId: 'prod-uuid-1',
    userId: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    type: 'IN',
    quantity: 10,
    notes: 'Stock adjustment',
    ...overrides,
  };
}

export function createMockTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-uuid-1',
    name: 'Test Store',
    slug: 'test-store',
    aiApiKey: null,
    aiTokens: 10000,
    aiTokensUsed: 150,
    deletedAt: null,
    ...overrides,
  };
}
