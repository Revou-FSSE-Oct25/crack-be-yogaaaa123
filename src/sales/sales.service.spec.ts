/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Mock PrismaService
const mockPrismaService = () => ({
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  salesOrder: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  stockTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
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

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            update: jest.fn().mockResolvedValue({
              id: 'prod-1',
              name: 'Product 1',
              stockQuantity: -1,
              reorderLevel: 10,
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

      await expect(service.createSalesOrder(mockOrderData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelSalesOrder', () => {
    it('should cancel a PENDING sales order', async () => {
      const mockOrder = {
        id: 'so-1',
        orderNumber: 'SO-1001',
        status: 'PENDING',
      };

      prisma.salesOrder.findUniqueOrThrow.mockResolvedValue(mockOrder);
      prisma.salesOrder.update.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const result = await service.cancelSalesOrder('so-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw BadRequestException when cancelling a COMPLETED order', async () => {
      prisma.salesOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'so-1',
        orderNumber: 'SO-1001',
        status: 'COMPLETED',
      });

      await expect(service.cancelSalesOrder('so-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cancelling an already CANCELLED order', async () => {
      prisma.salesOrder.findUniqueOrThrow.mockResolvedValue({
        id: 'so-1',
        orderNumber: 'SO-1001',
        status: 'CANCELLED',
      });

      await expect(service.cancelSalesOrder('so-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSalesOrders', () => {
    it('should return paginated sales orders with default limit', async () => {
      const mockOrders = [
        { id: 'so-1', orderNumber: 'SO-1001' },
        { id: 'so-2', orderNumber: 'SO-1002' },
      ];

      prisma.salesOrder.findMany.mockResolvedValue(mockOrders);

      const result = await service.getSalesOrders();
      expect(result).toHaveLength(2);
      expect(prisma.salesOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter by customerId when provided', async () => {
      prisma.salesOrder.findMany.mockResolvedValue([]);

      await service.getSalesOrders({ customerId: 'CUST-001' });

      expect(prisma.salesOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'CUST-001' }),
        }),
      );
    });
  });
});
