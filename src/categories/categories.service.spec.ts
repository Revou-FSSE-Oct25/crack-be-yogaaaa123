import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const createMockClient = () => ({
  category: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
});

const mockPrismaService = () => ({
  category: {
    create: jest.fn(),
  },
  getClient: jest.fn(),
});

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a category using prisma directly', async () => {
      prisma.category.create.mockResolvedValue({ id: 'c-1', name: 'Beverages', tenantId: 't-1' });

      const result = await service.create({ name: 'Beverages' }, 't-1');
      expect(result.id).toBe('c-1');
      expect(result.name).toBe('Beverages');
    });
  });

  describe('findAll', () => {
    it('should return paginated categories', async () => {
      const mockClient = createMockClient();
      mockClient.category.findMany.mockResolvedValue([{ id: 'c-1', name: 'Food' }]);
      mockClient.category.count.mockResolvedValue(1);
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findAll('t-1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should default take to 50', async () => {
      const mockClient = createMockClient();
      mockClient.category.findMany.mockResolvedValue([]);
      mockClient.category.count.mockResolvedValue(0);
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('t-1');
      expect(mockClient.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return category when found', async () => {
      const mockClient = createMockClient();
      mockClient.category.findFirst.mockResolvedValue({ id: 'c-1', name: 'Food' });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findOne('c-1', 't-1');
      expect(result.name).toBe('Food');
    });

    it('should throw NotFoundException when not found', async () => {
      const mockClient = createMockClient();
      mockClient.category.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.findOne('nonexistent', 't-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return category', async () => {
      const mockClient = createMockClient();
      mockClient.category.findFirst.mockResolvedValue({ id: 'c-1' });
      mockClient.category.update.mockResolvedValue({ id: 'c-1', name: 'Updated' });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.update('c-1', { name: 'Updated' }, 't-1');
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should soft delete category', async () => {
      const mockClient = createMockClient();
      mockClient.category.findFirst.mockResolvedValue({ id: 'c-1' });
      mockClient.category.update.mockResolvedValue({ id: 'c-1', deletedAt: new Date() });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.remove('c-1', 't-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });
});
