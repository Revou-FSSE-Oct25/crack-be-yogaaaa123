/* eslint-disable @typescript-eslint/no-unsafe-function-type */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { ReturnsService } from './returns.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const mockPrismaService = () => ({
  salesOrder: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  salesReturn: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  orderItem: {
    update: jest.fn(),
  },
  product: {
    update: jest.fn(),
  },
  stockTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('ReturnsService', () => {
  let service: ReturnsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnsService,
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReturnsService>(ReturnsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReturn', () => {
    const mockSalesOrder = {
      id: 'so-1',
      orderNumber: 'SO-1001',
      status: 'COMPLETED',
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          quantity: 5,
          returnedQuantity: 0,
          unitPrice: new Prisma.Decimal('100.00'),
          cogs: new Prisma.Decimal('400.00'), // total for 5 units, i.e. 80/unit
        },
      ],
    };

    const returnDto = {
      returnNumber: 'RET-001',
      salesOrderId: 'so-1',
      reason: 'Damaged item',
      items: [{ orderItemId: 'item-1', quantity: 2 }],
    };

    it('should create a return and update financials correctly', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(mockSalesOrder);

      const mockReturn = {
        id: 'ret-1',
        returnNumber: 'RET-001',
        totalRefund: new Prisma.Decimal('200.00'),
        status: 'COMPLETED',
      };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesReturn: {
            create: jest.fn().mockResolvedValue(mockReturn),
          },
          orderItem: {
            update: jest.fn().mockResolvedValue({}),
          },
          product: {
            update: jest.fn().mockResolvedValue({}),
          },
          stockTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
          salesOrder: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createReturn(returnDto, 'user-1');

      expect(result.returnNumber).toBe('RET-001');
      // totalRefund = 2 * 100 = 200
      expect(result.totalRefund).toEqual(new Prisma.Decimal('200.00'));
    });

    it('should throw NotFoundException when sales order does not exist', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(null);

      await expect(service.createReturn(returnDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for non-COMPLETED orders', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue({
        ...mockSalesOrder,
        status: 'PENDING',
      });

      await expect(service.createReturn(returnDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when return quantity exceeds returnable quantity', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue({
        ...mockSalesOrder,
        items: [
          {
            ...mockSalesOrder.items[0],
            quantity: 5,
            returnedQuantity: 4, // only 1 left to return
          },
        ],
      });

      const invalidReturn = {
        ...returnDto,
        items: [{ orderItemId: 'item-1', quantity: 2 }], // tries to return 2 but only 1 allowed
      };

      await expect(
        service.createReturn(invalidReturn, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
