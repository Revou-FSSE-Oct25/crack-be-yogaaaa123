type MockPrismaModel = Record<string, jest.Mock>;

function createModelMock() {
  return {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

export interface MockPrismaService {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $on: jest.Mock;
  $extends: jest.Mock;
  $transaction: jest.Mock;
  $use: jest.Mock;
  getClient: jest.Mock;
  refreshToken: MockPrismaModel;
  tenantUser: MockPrismaModel;
  tenant: MockPrismaModel;
  platformUser: MockPrismaModel;
  platformAdmin: MockPrismaModel;
  tenantMember: MockPrismaModel;
  product: MockPrismaModel;
  category: MockPrismaModel;
  supplier: MockPrismaModel;
  salesOrder: MockPrismaModel;
  purchaseOrder: MockPrismaModel;
  stockTransaction: MockPrismaModel;
  salesReturn: MockPrismaModel;
  activityLog: MockPrismaModel;
}

export function createMockPrisma(): MockPrismaService {
  const models = [
    'refreshToken',
    'tenantUser',
    'tenant',
    'platformUser',
    'platformAdmin',
    'tenantMember',
    'product',
    'category',
    'supplier',
    'salesOrder',
    'purchaseOrder',
    'stockTransaction',
    'salesReturn',
    'activityLog',
  ];

  const prismaMock: Record<string, unknown> = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    $extends: jest.fn().mockReturnThis(),
    $transaction: jest.fn().mockImplementation(
      (arg: unknown) => (typeof arg === 'function' ? arg(prismaMock) : Promise.resolve([])),
    ),
    $use: jest.fn(),
    getClient: jest.fn().mockReturnThis(),
  };

  for (const model of models) {
    prismaMock[model] = createModelMock();
  }

  return prismaMock as unknown as MockPrismaService;
}
