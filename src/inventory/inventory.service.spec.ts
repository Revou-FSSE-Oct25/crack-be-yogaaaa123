import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

const mockPrismaService = () => ({
  product: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  stockTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
});

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('adjustStock', () => {
    const productId = 'product-uuid-1';
    const userId = 'user-uuid-1';

    it('should increment stock for IN transaction', async () => {
      const mockTransaction = {
        id: 'tx-1',
        type: TransactionType.IN,
        quantity: 10,
        productId,
        userId,
      };
      const mockUpdatedProduct = {
        id: productId,
        name: 'Test Product',
        stockQuantity: 60,
      };

      prisma.product.findUniqueOrThrow.mockResolvedValue({
        id: productId,
        name: 'Test Product',
        stockQuantity: 50,
      });

      prisma.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<unknown>) => {
          const tx = {
            stockTransaction: {
              create: jest.fn().mockResolvedValue(mockTransaction),
            },
            product: {
              update: jest.fn().mockResolvedValue(mockUpdatedProduct),
            },
          };
          return await callback(tx);
        },
      );

      const result = await service.adjustStock(
        productId,
        userId,
        10,
        TransactionType.IN,
      );

      expect(result.transaction).toEqual(mockTransaction);
      expect(result.product.stockQuantity).toBe(60);
    });

    it('should decrement stock for OUT transaction', async () => {
      const mockTransaction = {
        id: 'tx-2',
        type: TransactionType.OUT,
        quantity: 5,
        productId,
        userId,
      };
      const mockUpdatedProduct = {
        id: productId,
        name: 'Test Product',
        stockQuantity: 45,
      };

      prisma.product.findUniqueOrThrow.mockResolvedValue({
        id: productId,
        name: 'Test Product',
        stockQuantity: 50,
      });

      prisma.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<unknown>) => {
          const tx = {
            stockTransaction: {
              create: jest.fn().mockResolvedValue(mockTransaction),
            },
            product: {
              update: jest.fn().mockResolvedValue(mockUpdatedProduct),
            },
          };
          return await callback(tx);
        },
      );

      const result = await service.adjustStock(
        productId,
        userId,
        5,
        TransactionType.OUT,
      );

      expect(result.transaction).toEqual(mockTransaction);
      expect(result.product.stockQuantity).toBe(45);
    });

    it('should throw BadRequestException when stock goes negative', async () => {
      prisma.product.findUniqueOrThrow.mockResolvedValue({
        id: productId,
        name: 'Test Product',
        stockQuantity: 3,
      });

      prisma.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<unknown>) => {
          const tx = {
            stockTransaction: {
              create: jest.fn().mockResolvedValue({}),
            },
            product: {
              update: jest.fn().mockResolvedValue({
                id: productId,
                stockQuantity: -2,
              }),
            },
          };
          return await callback(tx);
        },
      );

      await expect(
        service.adjustStock(productId, userId, 5, TransactionType.OUT),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle ADJUSTMENT type with negative quantity', async () => {
      const mockUpdatedProduct = {
        id: productId,
        stockQuantity: 47,
      };

      prisma.product.findUniqueOrThrow.mockResolvedValue({
        id: productId,
        stockQuantity: 50,
      });

      prisma.$transaction.mockImplementation(
        async (callback: (tx: any) => Promise<unknown>) => {
          const tx = {
            stockTransaction: {
              create: jest.fn().mockResolvedValue({}),
            },
            product: {
              update: jest.fn().mockResolvedValue(mockUpdatedProduct),
            },
          };
          return await callback(tx);
        },
      );

      const result = await service.adjustStock(
        productId,
        userId,
        -3,
        TransactionType.ADJUSTMENT,
      );

      expect(result.product.stockQuantity).toBe(47);
    });
  });

  describe('checkStockAvailability', () => {
    it('should return product when stock is sufficient', async () => {
      const mockProduct = {
        stockQuantity: 50,
        name: 'Test Product',
      };

      prisma.product.findUniqueOrThrow.mockResolvedValue(mockProduct);

      const result = await service.checkStockAvailability('product-1', 10);
      expect(result.stockQuantity).toBe(50);
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      prisma.product.findUniqueOrThrow.mockResolvedValue({
        stockQuantity: 3,
        name: 'Test Product',
      });

      await expect(
        service.checkStockAvailability('product-1', 10),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkReorderLevel', () => {
    it('should return isBelowReorderLevel=true when stock <= reorderLevel', async () => {
      prisma.product.findUniqueOrThrow.mockResolvedValue({
        stockQuantity: 5,
        reorderLevel: 10,
        name: 'Test Product',
        sku: 'SKU-001',
      });

      const result = await service.checkReorderLevel('product-1');
      expect(result.isBelowReorderLevel).toBe(true);
    });

    it('should return isBelowReorderLevel=false when stock > reorderLevel', async () => {
      prisma.product.findUniqueOrThrow.mockResolvedValue({
        stockQuantity: 50,
        reorderLevel: 10,
        name: 'Test Product',
        sku: 'SKU-001',
      });

      const result = await service.checkReorderLevel('product-1');
      expect(result.isBelowReorderLevel).toBe(false);
    });
  });

  describe('getLowStockProducts', () => {
    it('should call $queryRaw and return low stock products', async () => {
      const mockProducts = [
        {
          id: 'p1',
          sku: 'SKU-001',
          name: 'Low Stock Item',
          stockQuantity: 2,
          reorderLevel: 10,
          supplierName: 'Supplier A',
        },
      ];

      prisma.$queryRaw.mockResolvedValue(mockProducts);

      const result = await service.getLowStockProducts();
      expect(result).toEqual(mockProducts);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
