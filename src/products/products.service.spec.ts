import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

const createMockClient = () => ({
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
});

const mockPrismaService = () => ({
  getClient: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = { name: 'New Product', sku: 'PROD-001', unitPrice: '50.00', categoryId: 'cat-1', supplierId: 'sup-1' };

    it('should create and return a product', async () => {
      const mockClient = createMockClient();
      mockClient.product.create.mockResolvedValue({ id: 'p-1', ...dto, tenantId: 't-1' });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.create(dto, 't-1');
      expect(result.id).toBe('p-1');
      expect(mockClient.product.create).toHaveBeenCalledWith({
        data: { ...dto, tenantId: 't-1' },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated products with total', async () => {
      const mockClient = createMockClient();
      mockClient.product.findMany.mockResolvedValue([{ id: 'p-1', name: 'Product 1' }]);
      mockClient.product.count.mockResolvedValue(1);
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findAll('t-1', { skip: 0, take: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply search filter', async () => {
      const mockClient = createMockClient();
      mockClient.product.findMany.mockResolvedValue([]);
      mockClient.product.count.mockResolvedValue(0);
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('t-1', { search: 'test' });
      expect(mockClient.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'test' }) }),
            ]),
          }),
        }),
      );
    });

    it('should filter by categoryId', async () => {
      const mockClient = createMockClient();
      mockClient.product.findMany.mockResolvedValue([]);
      mockClient.product.count.mockResolvedValue(0);
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('t-1', { categoryId: 'cat-1' });
      expect(mockClient.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ categoryId: 'cat-1' }) }),
      );
    });

    it('should default take to 50 when not provided', async () => {
      const mockClient = createMockClient();
      mockClient.product.findMany.mockResolvedValue([]);
      mockClient.product.count.mockResolvedValue(0);
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('t-1');
      expect(mockClient.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return product when found', async () => {
      const mockClient = createMockClient();
      mockClient.product.findFirst.mockResolvedValue({ id: 'p-1', name: 'Product 1' });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findOne('p-1', 't-1');
      expect(result.id).toBe('p-1');
    });

    it('should throw NotFoundException when not found', async () => {
      const mockClient = createMockClient();
      mockClient.product.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.findOne('nonexistent', 't-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return product', async () => {
      const mockClient = createMockClient();
      mockClient.product.findFirst.mockResolvedValue({ id: 'p-1' });
      mockClient.product.update.mockResolvedValue({ id: 'p-1', name: 'Updated' });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.update('p-1', { name: 'Updated' }, 't-1');
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      const mockClient = createMockClient();
      mockClient.product.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.update('nonexistent', { name: 'Updated' }, 't-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete product', async () => {
      const mockClient = createMockClient();
      mockClient.product.findFirst.mockResolvedValue({ id: 'p-1' });
      mockClient.product.update.mockResolvedValue({ id: 'p-1', deletedAt: new Date() });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.remove('p-1', 't-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      const mockClient = createMockClient();
      mockClient.product.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.remove('nonexistent', 't-1')).rejects.toThrow(NotFoundException);
    });
  });
});
