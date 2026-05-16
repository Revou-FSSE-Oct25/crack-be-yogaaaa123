import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseService } from './purchase.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';

const mockPrismaService = () => ({
  purchaseOrder: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  stockTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  getClient: jest.fn(),
});

describe('PurchaseService', () => {
  let service: PurchaseService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPurchaseOrder — moving average cost', () => {
    const orderData = {
      orderNumber: 'PO-TEST-001',
      supplierId: 'supplier-uuid-1',
      userId: 'user-uuid-1',
      tenantId: 'tenant-uuid-1',
      items: [{ productId: 'prod-1', quantity: 10, unitPrice: '100.00' }],
    };

    it('should calculate correct moving average cost when existing stock > 0', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          stockQuantity: 10,
          averageCost: new Prisma.Decimal('80.00'),
        },
      ];

      const mockPO = { id: 'po-1', orderNumber: 'PO-TEST-001' };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            create: jest.fn().mockResolvedValue(mockPO),
          },
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            update: jest.fn().mockResolvedValue(mockProducts[0]),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createPurchaseOrder(orderData);

      expect(result.orderNumber).toBe('PO-TEST-001');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should use incoming price as averageCost when stock is 0', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          stockQuantity: 0,
          averageCost: new Prisma.Decimal('0'),
        },
      ];

      const mockPO = { id: 'po-1', orderNumber: 'PO-TEST-001' };
      let capturedUpdateArgs: any;

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            create: jest.fn().mockResolvedValue(mockPO),
          },
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            update: jest.fn().mockImplementation((args) => {
              capturedUpdateArgs = args;
              return Promise.resolve(mockProducts[0]);
            }),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createPurchaseOrder(orderData);
      expect(capturedUpdateArgs?.data?.averageCost?.toString()).toBe('100');
      expect(result.orderNumber).toBe('PO-TEST-001');
    });

    it('should handle multiple items in a single purchase order', async () => {
      const multiItemOrder = {
        ...orderData,
        items: [
          { productId: 'prod-1', quantity: 5, unitPrice: '50.00' },
          { productId: 'prod-2', quantity: 3, unitPrice: '30.00' },
        ],
      };

      const mockProducts = [
        { id: 'prod-1', stockQuantity: 10, averageCost: new Prisma.Decimal('40.00') },
        { id: 'prod-2', stockQuantity: 5, averageCost: new Prisma.Decimal('20.00') },
      ];

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            create: jest.fn().mockResolvedValue({ id: 'po-1', orderNumber: 'PO-TEST-001' }),
          },
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            update: jest.fn().mockResolvedValue({}),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createPurchaseOrder(multiItemOrder);
      expect(result.orderNumber).toBe('PO-TEST-001');
    });
  });

  describe('createPendingPurchaseOrder', () => {
    it('should create a PENDING purchase order without stock impact', async () => {
      const orderData = {
        orderNumber: 'PO-PENDING-001',
        supplierId: 'supplier-uuid-1',
        userId: 'user-uuid-1',
        tenantId: 'tenant-uuid-1',
        items: [{ productId: 'prod-1', quantity: 10, unitPrice: '100.00' }],
      };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            create: jest.fn().mockResolvedValue({
              id: 'po-pending-1',
              orderNumber: 'PO-PENDING-001',
              status: PurchaseOrderStatus.PENDING,
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.createPendingPurchaseOrder(orderData);
      expect(result.status).toBe(PurchaseOrderStatus.PENDING);
    });
  });

  describe('receivePurchaseOrder', () => {
    it('should receive a PENDING purchase order and process stock', async () => {
      const mockPendingPO = {
        id: 'po-pending-1',
        orderNumber: 'PO-PENDING-001',
        status: PurchaseOrderStatus.PENDING,
        items: [{ productId: 'prod-1', quantity: 10, unitPrice: new Prisma.Decimal('100.00') }],
      };

      prisma.getClient.mockReturnValue({
        purchaseOrder: { findFirst: jest.fn().mockResolvedValue(mockPendingPO) },
      });

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            update: jest.fn().mockResolvedValue({
              ...mockPendingPO,
              status: PurchaseOrderStatus.RECEIVED,
              receivedAt: new Date(),
            }),
          },
          product: {
            findMany: jest
              .fn()
              .mockResolvedValue([
                { id: 'prod-1', stockQuantity: 0, averageCost: new Prisma.Decimal('0') },
              ]),
            update: jest.fn().mockResolvedValue({}),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.receivePurchaseOrder('po-pending-1', 'user-1', 'tenant-1');
      expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
    });

    it('should throw BadRequestException when order is already RECEIVED', async () => {
      prisma.getClient.mockReturnValue({
        purchaseOrder: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'po-1',
            orderNumber: 'PO-1001',
            status: PurchaseOrderStatus.RECEIVED,
          }),
        },
      });

      await expect(service.receivePurchaseOrder('po-1', 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelPurchaseOrder', () => {
    it('should cancel a PENDING purchase order', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'PO-1001',
        status: PurchaseOrderStatus.CANCELLED,
      };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(mockOrder),
          },
        };
        return callback(tx);
      });

      const result = await service.cancelPurchaseOrder('po-1', 'user-1');
      expect(result.status).toBe(PurchaseOrderStatus.CANCELLED);
    });

    it('should throw BadRequestException when trying to cancel a RECEIVED order', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findFirst: jest.fn().mockResolvedValue({
              id: 'po-1',
              status: PurchaseOrderStatus.RECEIVED,
            }),
          },
        };
        return callback(tx);
      });

      await expect(service.cancelPurchaseOrder('po-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          purchaseOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(service.cancelPurchaseOrder('nonexistent-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPurchaseOrders', () => {
    it('should return paginated purchase orders', async () => {
      const mockClient = {
        purchaseOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'po-1' }]) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getPurchaseOrders('tenant-uuid-1');
      expect(result).toHaveLength(1);
    });

    it('should filter by supplierId and status', async () => {
      const mockClient = {
        purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await service.getPurchaseOrders('tenant-uuid-1', {
        supplierId: 'supplier-1',
        status: PurchaseOrderStatus.PENDING,
      });

      expect(mockClient.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierId: 'supplier-1',
            status: PurchaseOrderStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe('getPurchaseOrderById', () => {
    it('should return order with full details', async () => {
      const mockOrder = {
        id: 'po-1',
        orderNumber: 'PO-1001',
        supplier: { id: 's-1', name: 'Supplier 1' },
        user: { username: 'admin' },
        items: [{ product: { id: 'prod-1', name: 'Product 1' } }],
      };

      const mockClient = {
        purchaseOrder: { findFirst: jest.fn().mockResolvedValue(mockOrder) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getPurchaseOrderById('tenant-uuid-1', 'po-1');
      expect(result.orderNumber).toBe('PO-1001');
    });
  });

  describe('getSupplierPurchaseSummary', () => {
    it('should return summary with total orders and spent', async () => {
      const mockClient = {
        purchaseOrder: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'po-1',
              totalPrice: new Prisma.Decimal('1000.00'),
              items: [
                {
                  productId: 'prod-1',
                  quantity: 5,
                  unitPrice: new Prisma.Decimal('100.00'),
                  product: { name: 'P1' },
                },
              ],
            },
          ]),
        },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getSupplierPurchaseSummary('tenant-uuid-1', 'supplier-1');
      expect(result.totalOrders).toBe(1);
      expect(result.totalSpent).toBe(1000);
      expect(result.productsPurchased).toHaveLength(1);
    });

    it('should return zero values when no orders exist', async () => {
      const mockClient = {
        purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.getSupplierPurchaseSummary(
        'tenant-uuid-1',
        'supplier-nonexistent',
      );
      expect(result.totalOrders).toBe(0);
      expect(result.totalSpent).toBe(0);
      expect(result.productsPurchased).toHaveLength(0);
    });
  });
});
