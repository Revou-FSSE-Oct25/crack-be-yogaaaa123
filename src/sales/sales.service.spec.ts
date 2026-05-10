import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const mockPrismaService = () => ({
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  salesOrder: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  stockTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  getClient: jest.fn(),
});

describe('SalesService', () => {
  let service: SalesService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SalesService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<SalesService>(SalesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSalesOrder', () => {
    const mockOrderData = {
      orderNumber: 'SO-TEST-001',
      customerId: 'CUST-001',
      userId: 'user-uuid-1',
      tenantId: 'tenant-uuid-1',
      items: [
        { productId: 'prod-1', quantity: 2, unitPrice: '100.00' },
        { productId: 'prod-2', quantity: 1, unitPrice: '50.00' },
      ],
    };

    it('should create a completed sales order with correct COGS and profit', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          name: 'Product 1',
          averageCost: new Prisma.Decimal('80.00'),
          stockQuantity: 50,
          reorderLevel: 10,
        },
        {
          id: 'prod-2',
          name: 'Product 2',
          averageCost: new Prisma.Decimal('30.00'),
          stockQuantity: 30,
          reorderLevel: 5,
        },
      ];

      const mockSalesOrder = {
        id: 'so-uuid-1',
        orderNumber: 'SO-TEST-001',
        status: 'COMPLETED',
        totalPrice: new Prisma.Decimal('250.00'),
        totalCogs: new Prisma.Decimal('190.00'),
        totalProfit: new Prisma.Decimal('60.00'),
      };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            update: jest.fn().mockImplementation(({ where }) => {
              const product = mockProducts.find((p) => p.id === where.id);
              return Promise.resolve({
                ...product,
                stockQuantity: product!.stockQuantity - 1,
              });
            }),
          },
          salesOrder: {
            create: jest.fn().mockResolvedValue(mockSalesOrder),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createSalesOrder(mockOrderData);

      expect(result.orderNumber).toBe('SO-TEST-001');
      expect(result.status).toBe('COMPLETED');
      expect(result.totalCogs).toEqual(new Prisma.Decimal('190.00'));
      expect(result.totalProfit).toEqual(new Prisma.Decimal('60.00'));
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return callback(tx);
      });

      await expect(service.createSalesOrder(mockOrderData)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for insufficient stock', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          name: 'Product 1',
          averageCost: new Prisma.Decimal('80.00'),
          stockQuantity: 50,
          reorderLevel: 10,
        },
        {
          id: 'prod-2',
          name: 'Product 2',
          averageCost: new Prisma.Decimal('30.00'),
          stockQuantity: 30,
          reorderLevel: 5,
        },
      ];

      const mockSalesOrder = {
        id: 'so-uuid-1',
        orderNumber: 'SO-TEST-001',
        status: 'COMPLETED',
      };

      const prismaError = new Error('Record to update not found.');
      (prismaError as any).code = 'P2025';

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            update: jest.fn().mockRejectedValue(prismaError),
          },
          salesOrder: {
            create: jest.fn().mockResolvedValue(mockSalesOrder),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await expect(service.createSalesOrder(mockOrderData)).rejects.toThrow(BadRequestException);
    });

    it('should handle empty items gracefully', async () => {
      const emptyOrder = { ...mockOrderData, items: [] };
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          salesOrder: {
            create: jest.fn().mockResolvedValue({
              id: 'so-uuid-1',
              orderNumber: 'SO-EMPTY',
              status: 'COMPLETED',
              totalPrice: new Prisma.Decimal('0'),
              totalCogs: new Prisma.Decimal('0'),
              totalProfit: new Prisma.Decimal('0'),
            }),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createSalesOrder(emptyOrder);
      expect(result.totalPrice).toEqual(new Prisma.Decimal('0'));
    });
  });

  describe('createPendingSalesOrder', () => {
    it('should create a PENDING sales order without stock impact', async () => {
      const mockOrderData = {
        orderNumber: 'SO-PENDING-001',
        customerId: 'CUST-001',
        userId: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        items: [{ productId: 'prod-1', quantity: 2, unitPrice: '100.00' }],
      };

      const mockProducts = [
        {
          id: 'prod-1',
          name: 'Product 1',
          averageCost: new Prisma.Decimal('80.00'),
          stockQuantity: 50,
          reorderLevel: 10,
        },
      ];

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
          },
          salesOrder: {
            create: jest.fn().mockResolvedValue({
              id: 'so-pending-1',
              orderNumber: 'SO-PENDING-001',
              status: 'PENDING',
              totalPrice: new Prisma.Decimal('200.00'),
              totalCogs: new Prisma.Decimal('160.00'),
              totalProfit: new Prisma.Decimal('40.00'),
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.createPendingSalesOrder(mockOrderData);
      expect(result.status).toBe('PENDING');
      expect(result.totalProfit).toEqual(new Prisma.Decimal('40.00'));
    });
  });

  describe('completeSalesOrder', () => {
    it('should complete a PENDING order and process stock out', async () => {
      const mockPendingOrder = {
        id: 'so-pending-1',
        orderNumber: 'SO-PENDING-001',
        status: 'PENDING',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2 }],
      };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesOrder: {
            findFirst: jest.fn().mockResolvedValue(mockPendingOrder),
            findUnique: jest.fn(),
            update: jest.fn().mockResolvedValue({
              ...mockPendingOrder,
              status: 'COMPLETED',
              orderNumber: 'SO-PENDING-001',
            }),
          },
          product: {
            update: jest.fn().mockResolvedValue({
              id: 'prod-1',
              name: 'Product 1',
              stockQuantity: 48,
              reorderLevel: 10,
            }),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.completeSalesOrder('so-pending-1', 'user-1', 'tenant-1');
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw BadRequestException when order is already COMPLETED', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue({
              id: 'so-1',
              status: 'COMPLETED',
            }),
          },
        };
        return callback(tx);
      });

      await expect(service.completeSalesOrder('so-1', 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when order does not exist', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(service.completeSalesOrder('nonexistent', 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelSalesOrder', () => {
    it('should cancel a PENDING sales order', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'SO-1001',
        status: 'CANCELLED',
      };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(mockOrder),
          },
        };
        return callback(tx);
      });

      const result = await service.cancelSalesOrder('so-1', 'user-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw BadRequestException when cancelling a COMPLETED order', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findFirst: jest.fn().mockResolvedValue({
              id: 'so-1',
              status: 'COMPLETED',
            }),
          },
        };
        return callback(tx);
      });

      await expect(service.cancelSalesOrder('so-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cancelling an already CANCELLED order', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findFirst: jest.fn().mockResolvedValue({
              id: 'so-1',
              status: 'CANCELLED',
            }),
          },
        };
        return callback(tx);
      });

      await expect(service.cancelSalesOrder('so-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(service.cancelSalesOrder('nonexistent-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSalesOrders', () => {
    it('should return paginated sales orders with default limit', async () => {
      const mockOrders = [
        { id: 'so-1', orderNumber: 'SO-1001' },
        { id: 'so-2', orderNumber: 'SO-1002' },
      ];

      const mockClient = {
        salesOrder: { findMany: jest.fn().mockResolvedValue(mockOrders) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getSalesOrders('tenant-uuid-1');
      expect(result).toHaveLength(2);
      expect(mockClient.salesOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter by customerId when provided', async () => {
      const mockClient = {
        salesOrder: { findMany: jest.fn().mockResolvedValue([]) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await service.getSalesOrders('tenant-uuid-1', { customerId: 'CUST-001' });

      expect(mockClient.salesOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'CUST-001' }),
        }),
      );
    });

    it('should filter by status when provided', async () => {
      const mockClient = {
        salesOrder: { findMany: jest.fn().mockResolvedValue([]) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await service.getSalesOrders('tenant-uuid-1', { status: 'PENDING' });

      expect(mockClient.salesOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });
  });

  describe('getSalesOrderById', () => {
    it('should return order with items and user info', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'SO-1001',
        user: { username: 'admin' },
        items: [
          {
            product: {
              id: 'prod-1',
              sku: 'SKU-001',
              name: 'Product 1',
              price: new Prisma.Decimal('100'),
            },
          },
        ],
      };

      const mockClient = {
        salesOrder: { findFirst: jest.fn().mockResolvedValue(mockOrder) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getSalesOrderById('tenant-uuid-1', 'so-1');
      expect(result.orderNumber).toBe('SO-1001');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      const mockClient = {
        salesOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.getSalesOrderById('tenant-uuid-1', 'nonexistent')).rejects.toThrow();
    });
  });
});
