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
    count: jest.fn(),
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
  getClient: jest.fn(),
});

describe('ReturnsService', () => {
  let service: ReturnsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReturnsService, { provide: PrismaService, useFactory: mockPrismaService }],
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
      tenantId: 'tenant-1',
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

    function setupGetClientMock() {
      const mockClient = {
        salesOrder: {
          findUnique: jest.fn(),
        },
      };
      prisma.getClient.mockReturnValue(mockClient);
      return mockClient;
    }

    it('should create a return and update financials correctly', async () => {
      const mockClient = setupGetClientMock();
      mockClient.salesOrder.findUnique.mockResolvedValue(mockSalesOrder);

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

      const result = await service.createReturn(returnDto, 'user-1', 'tenant-1');

      expect(result.returnNumber).toBe('RET-001');
      // totalRefund = 2 * 100 = 200
      expect(result.totalRefund).toEqual(new Prisma.Decimal('200.00'));
    });

    it('should throw NotFoundException when sales order does not exist', async () => {
      const mockClient = setupGetClientMock();
      mockClient.salesOrder.findUnique.mockResolvedValue(null);

      await expect(service.createReturn(returnDto, 'user-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for non-COMPLETED orders', async () => {
      const mockClient = setupGetClientMock();
      mockClient.salesOrder.findUnique.mockResolvedValue({
        ...mockSalesOrder,
        status: 'PENDING',
      });

      await expect(service.createReturn(returnDto, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when return quantity exceeds returnable quantity', async () => {
      const mockClient = setupGetClientMock();
      mockClient.salesOrder.findUnique.mockResolvedValue({
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

      await expect(service.createReturn(invalidReturn, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when orderItem does not belong to the sales order', async () => {
      const mockClient = setupGetClientMock();
      mockClient.salesOrder.findUnique.mockResolvedValue(mockSalesOrder);

      const invalidReturn = {
        ...returnDto,
        items: [{ orderItemId: 'nonexistent-item', quantity: 1 }],
      };

      await expect(service.createReturn(invalidReturn, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should correctly decrement totalProfit and totalCogs on the sales order', async () => {
      const mockClient = setupGetClientMock();
      mockClient.salesOrder.findUnique.mockResolvedValue(mockSalesOrder);

      let capturedSalesOrderUpdate: any;

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          salesReturn: {
            create: jest.fn().mockResolvedValue({
              id: 'ret-1',
              returnNumber: 'RET-001',
              totalRefund: new Prisma.Decimal('200.00'),
              status: 'COMPLETED',
            }),
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
            update: jest.fn().mockImplementation((args) => {
              capturedSalesOrderUpdate = args;
              return Promise.resolve({});
            }),
          },
        };
        return callback(tx);
      });

      await service.createReturn(returnDto, 'user-1', 'tenant-1');

      // cogs per unit = 400 / 5 = 80
      // profit per unit = 100 - 80 = 20
      // returned: 2 units => decrement profit by 40, cogs by 160
      expect(capturedSalesOrderUpdate.data.totalProfit.decrement).toEqual(
        new Prisma.Decimal('40.00'),
      );
      expect(capturedSalesOrderUpdate.data.totalCogs.decrement).toEqual(
        new Prisma.Decimal('160.00'),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated returns with total count', async () => {
      const mockClient = {
        salesReturn: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'ret-1',
              returnNumber: 'RET-001',
              salesOrder: { orderNumber: 'SO-001' },
              user: { username: 'admin' },
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
        },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findAll('tenant-uuid-1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply pagination when skip and take are provided', async () => {
      const mockClient = {
        salesReturn: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('tenant-uuid-1', 10, 5);
      expect(mockClient.salesReturn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('should default take to 50', async () => {
      const mockClient = {
        salesReturn: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('tenant-uuid-1');
      expect(mockClient.salesReturn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return return with full details', async () => {
      const mockReturn = {
        id: 'ret-1',
        returnNumber: 'RET-001',
        items: [{ orderItem: { product: { name: 'Product 1' } } }],
        salesOrder: { orderNumber: 'SO-001' },
        user: { username: 'admin' },
      };

      const mockClient = {
        salesReturn: { findUniqueOrThrow: jest.fn().mockResolvedValue(mockReturn) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findOne('tenant-uuid-1', 'ret-1');
      expect(result.returnNumber).toBe('RET-001');
    });

    it('should throw NotFoundException when return does not exist', async () => {
      const mockClient = {
        salesReturn: { findUniqueOrThrow: jest.fn().mockRejectedValue(new Error('Not found')) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.findOne('tenant-uuid-1', 'nonexistent')).rejects.toThrow();
    });
  });
});
