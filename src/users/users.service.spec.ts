import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const createMockClient = () => ({
  tenantUser: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
});

const mockPrismaService = () => ({
  tenantUser: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  getClient: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      username: 'testuser',
      password: 'password123',
      tenantId: 'tenant-uuid-1',
    };

    it('should create a user and return without passwordHash', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);
      prisma.tenantUser.create.mockResolvedValue({
        id: 'user-1',
        username: dto.username,
        role: 'STAFF',
        passwordHash: 'hashed',
        createdAt: new Date(),
        deletedAt: null,
        tenantId: dto.tenantId,
      });

      const result = await service.create(dto, 'tenant-uuid-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.username).toBe('testuser');
    });

    it('should throw ConflictException if username already exists', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue({ id: 'existing-user' });
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.create(dto, 'tenant-uuid-1')).rejects.toThrow(ConflictException);
    });

    it('should assign default role STAFF when role is not provided', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);
      prisma.tenantUser.create.mockResolvedValue({
        id: 'user-1',
        username: dto.username,
        role: 'STAFF',
        passwordHash: 'hashed',
        createdAt: new Date(),
        deletedAt: null,
        tenantId: dto.tenantId,
      });

      const result = await service.create(dto, 'tenant-uuid-1');
      expect(result.role).toBe('STAFF');
    });
  });

  describe('findAll', () => {
    it('should use getClient and return users', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', role: 'ADMIN', createdAt: new Date() },
        { id: 'user-2', username: 'user2', role: 'STAFF', createdAt: new Date() },
      ];
      const mockClient = {
        tenantUser: { findMany: jest.fn().mockResolvedValue(mockUsers) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findAll('tenant-uuid-1');
      expect(result).toHaveLength(2);
      expect(prisma.getClient).toHaveBeenCalledWith('tenant-uuid-1');
    });

    it('should apply pagination when skip and take are provided', async () => {
      const mockClient = {
        tenantUser: { findMany: jest.fn().mockResolvedValue([]) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('tenant-uuid-1', 10, 5);
      expect(mockClient.tenantUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('should default take to 50 when not provided', async () => {
      const mockClient = {
        tenantUser: { findMany: jest.fn().mockResolvedValue([]) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await service.findAll('tenant-uuid-1');
      expect(mockClient.tenantUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('findOne', () => {
    it('should use getClient and return user when found', async () => {
      const mockUser = { id: 'user-1', username: 'testuser', deletedAt: null };
      const mockClient = {
        tenantUser: { findFirst: jest.fn().mockResolvedValue(mockUser) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.findOne('user-1', 'tenant-uuid-1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user is not found', async () => {
      const mockClient = {
        tenantUser: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.findOne('nonexistent', 'tenant-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUsername', () => {
    it('should only return non-deleted users', async () => {
      const activeUser = { id: 'user-1', username: 'testuser', deletedAt: null };
      prisma.tenantUser.findFirst.mockResolvedValue(activeUser);

      const result = await service.findByUsername('testuser');
      expect(result).toEqual(activeUser);
      expect(prisma.tenantUser.findFirst).toHaveBeenCalledWith({
        where: { username: 'testuser', deletedAt: null },
      });
    });

    it('should filter by tenantId when provided', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await service.findByUsername('testuser', 'tenant-1');
      expect(mockClient.tenantUser.findFirst).toHaveBeenCalledWith({
        where: { username: 'testuser', deletedAt: null, tenantId: 'tenant-1' },
      });
    });

    it('should return null for soft-deleted users', async () => {
      prisma.tenantUser.findFirst.mockResolvedValue(null);

      const result = await service.findByUsername('deleteduser');
      expect(result).toBeNull();
    });
  });

  describe('findByUsernameOrEmail', () => {
    it('should find user by username', async () => {
      const mockUser = { id: 'user-1', username: 'testuser', deletedAt: null };
      prisma.tenantUser.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByUsernameOrEmail('testuser');
      expect(result).toEqual(mockUser);
    });

    it('should return null for soft-deleted users', async () => {
      prisma.tenantUser.findFirst.mockResolvedValue(null);

      const result = await service.findByUsernameOrEmail('deleteduser');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should use getClient to verify user, then update via prisma directly', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue({ id: 'user-1', deletedAt: null });
      mockClient.tenantUser.update.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        role: 'ADMIN',
        passwordHash: 'secret',
      });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.update('user-1', { role: 'ADMIN' }, 'tenant-uuid-1');
      expect(result.role).toBe('ADMIN');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await expect(
        service.update('nonexistent', { role: 'ADMIN' }, 'tenant-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a user (set deletedAt)', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue({ id: 'user-1', deletedAt: null });
      mockClient.tenantUser.update.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        role: 'STAFF',
        deletedAt: new Date(),
      });
      prisma.getClient.mockReturnValue(mockClient);

      const result = await service.remove('user-1', 'tenant-uuid-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when user is not found', async () => {
      const mockClient = createMockClient();
      mockClient.tenantUser.findFirst.mockResolvedValue(null);
      prisma.getClient.mockReturnValue(mockClient);

      await expect(service.remove('nonexistent', 'tenant-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changePassword', () => {
    it('should hash and update new password when current password is correct', async () => {
      const currentPassword = 'oldpassword';
      const hashedCurrent = await bcrypt.hash(currentPassword, 10);

      prisma.tenantUser.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedCurrent,
        deletedAt: null,
      });
      prisma.tenantUser.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.changePassword('user-1', {
        currentPassword,
        newPassword: 'newpassword123',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(prisma.tenantUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      const hashedCurrent = await bcrypt.hash('correctpassword', 10);

      prisma.tenantUser.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedCurrent,
        deletedAt: null,
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when user is not found', async () => {
      prisma.tenantUser.findFirst.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', {
          currentPassword: 'any',
          newPassword: 'newpass',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
