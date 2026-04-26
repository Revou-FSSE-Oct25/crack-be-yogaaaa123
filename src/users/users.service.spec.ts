/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrismaService = () => ({
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
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
      email: 'test@example.com',
      password: 'password123',
    };

    it('should create a user and return without passwordHash', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // No existing user
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        username: dto.username,
        email: dto.email,
        role: 'STAFF',
        passwordHash: 'hashed',
        createdAt: new Date(),
        deletedAt: null,
      });

      const result = await service.create(dto);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.username).toBe('testuser');
    });

    it('should throw ConflictException if username already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findByUsername', () => {
    it('should only return non-deleted users', async () => {
      const activeUser = {
        id: 'user-1',
        username: 'testuser',
        deletedAt: null,
      };
      prisma.user.findUnique.mockResolvedValue(activeUser);

      const result = await service.findByUsername('testuser');
      expect(result).toEqual(activeUser);
      // Verify deletedAt: null is in the query
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser', deletedAt: null },
      });
    });
  });

  describe('changePassword', () => {
    it('should hash and update new password when current password is correct', async () => {
      const currentPassword = 'oldpassword';
      const hashedCurrent = await bcrypt.hash(currentPassword, 10);

      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        passwordHash: hashedCurrent,
        deletedAt: null,
      });
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.changePassword('user-1', {
        currentPassword,
        newPassword: 'newpassword123',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      const hashedCurrent = await bcrypt.hash('correctpassword', 10);

      prisma.user.findUniqueOrThrow.mockResolvedValue({
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
  });

  describe('remove', () => {
    it('should soft delete a user (set deletedAt)', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        deletedAt: null,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'STAFF',
        deletedAt: new Date(),
      });

      const result = await service.remove('user-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });
});
