import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const createMockClient = () => ({
  supplier: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
});

const mockPrismaService = () => ({
  supplier: {
    create: jest.fn(),
  },
  getClient: jest.fn(),
});

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a supplier using prisma directly', async () => {
      prisma.supplier.create.mockResolvedValue({ id: 's-1', name: 'Supplier A', tenantId: 't-1' });

      const result = await service.create({ name: 'Supplier A' }, 't-1');
      expect(result.id).toBe('s-1');
    });
  });

  describe('findAll', () => {
    it('should return paginated suppliers', async () => {
      const mockClient = createMockClient();
      mockClient.supplier.findMany.mockResolvedValue([{ id: 's-1', name: 'Supplier A' }]);
      mockClient.supplier.count.mockResolvedValue(1);
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findAll('t-1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return supplier when found', async () => {
      const mockClient = createMockClient();
      mockClient.supplier.findFirst.mockResolvedValue({ id: 's-1', name: 'Supplier A' });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findOne('s-1', 't-1');
      expect(result.name).toBe('Supplier A');
    });

    it('should throw NotFoundException when not found', async () => {
      const mockClient = createMockClient();
      mockClient.supplier.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.findOne('nonexistent', 't-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return supplier', async () => {
      const mockClient = createMockClient();
      mockClient.supplier.findFirst.mockResolvedValue({ id: 's-1' });
      mockClient.supplier.update.mockResolvedValue({ id: 's-1', name: 'Updated Supplier' });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.update('s-1', { name: 'Updated Supplier' }, 't-1');
      expect(result.name).toBe('Updated Supplier');
    });
  });

  describe('remove', () => {
    it('should soft delete supplier', async () => {
      const mockClient = createMockClient();
      mockClient.supplier.findFirst.mockResolvedValue({ id: 's-1' });
      mockClient.supplier.update.mockResolvedValue({ id: 's-1', deletedAt: new Date() });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.remove('s-1', 't-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });
});
