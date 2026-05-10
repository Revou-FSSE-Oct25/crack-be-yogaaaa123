import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

const createMockClient = () => ({
  salesOrder: {
    findMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
});

const mockPrismaService = () => ({
  getClient: jest.fn(),
});

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSalesReport', () => {
    it('should return summary and orders', async () => {
      const mockClient = createMockClient();
      mockClient.salesOrder.findMany.mockResolvedValue([
        {
          id: 'so-1',
          orderNumber: 'SO-001',
          status: 'COMPLETED',
          totalPrice: new Prisma.Decimal('250'),
          totalProfit: new Prisma.Decimal('50'),
          totalCogs: new Prisma.Decimal('200'),
          createdAt: new Date(),
          items: [],
          user: { username: 'admin1' },
        },
      ]);
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getSalesReport('t-1');
      expect(result.summary.totalOrders).toBe(1);
      expect(result.summary.totalRevenue).toBe(250);
      expect(result.summary.totalProfit).toBe(50);
      expect(result.orders).toHaveLength(1);
    });
  });

  describe('getInventoryReport', () => {
    it('should return inventory report with low stock count', async () => {
      const mockClient = createMockClient();
      mockClient.product.findMany.mockResolvedValue([
        { id: 'p-1', name: 'Product 1', sku: 'P-001', stockQuantity: 5, reorderLevel: 10, averageCost: new Prisma.Decimal('50'), price: new Prisma.Decimal('100'), category: { name: 'Cat 1' }, supplier: { name: 'Sup 1' } },
        { id: 'p-2', name: 'Product 2', sku: 'P-002', stockQuantity: 50, reorderLevel: 10, averageCost: new Prisma.Decimal('30'), price: new Prisma.Decimal('60'), category: { name: 'Cat 2' }, supplier: null },
      ]);
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getInventoryReport('t-1');
      expect(result.summary.totalProducts).toBe(2);
      expect(result.summary.totalStock).toBe(55);
      expect(result.summary.lowStock).toBe(1);
    });
  });

  describe('getProfitLoss', () => {
    it('should return profit/loss calculations', async () => {
      const mockClient = createMockClient();
      mockClient.salesOrder.findMany.mockResolvedValue([
        { totalPrice: new Prisma.Decimal('500'), totalCogs: new Prisma.Decimal('300'), totalProfit: new Prisma.Decimal('200') },
        { totalPrice: new Prisma.Decimal('300'), totalCogs: new Prisma.Decimal('200'), totalProfit: new Prisma.Decimal('100') },
      ]);
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getProfitLoss('t-1');
      expect(result.totalOrders).toBe(2);
      expect(result.totalRevenue).toBe(800);
      expect(result.totalCogs).toBe(500);
      expect(result.totalProfit).toBe(300);
      expect(result.profitMargin).toBe(37.5);
    });
  });

  describe('exportSalesCsv', () => {
    it('should return CSV string', async () => {
      const mockClient = createMockClient();
      mockClient.salesOrder.findMany.mockResolvedValue([
        { orderNumber: 'SO-001', status: 'COMPLETED', totalPrice: new Prisma.Decimal('250'), totalProfit: new Prisma.Decimal('50'), createdAt: new Date('2026-05-01'), items: [{ quantity: 2, unitPrice: new Prisma.Decimal('125'), product: { name: 'Product 1', sku: 'P-001' } }], user: { username: 'admin1' } },
      ]);
      prisma.getClient.mockReturnValue(mockClient);

      const csv = await service.exportSalesCsv('t-1');
      expect(csv).toContain('Order Number');
      expect(csv).toContain('SO-001');
    });
  });

  describe('exportInventoryCsv', () => {
    it('should return CSV string', async () => {
      const mockClient = createMockClient();
      mockClient.product.findMany.mockResolvedValue([
        { sku: 'P-001', name: 'Product 1', stockQuantity: 50, reorderLevel: 10, averageCost: new Prisma.Decimal('50'), price: new Prisma.Decimal('100'), category: { name: 'Cat' }, supplier: null },
      ]);
      prisma.getClient.mockReturnValue(mockClient);

      const csv = await service.exportInventoryCsv('t-1');
      expect(csv).toContain('SKU');
      expect(csv).toContain('P-001');
    });
  });
});
