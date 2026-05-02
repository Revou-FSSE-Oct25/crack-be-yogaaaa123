import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';

const mockUsersService = () => ({
  findByUsername: jest.fn(),
  findByUsernameOrEmail: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
});

const mockPrismaService = () => ({
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: ReturnType<typeof mockUsersService>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useFactory: mockUsersService },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const loginDto = { username: 'admin1', password: 'password123' };

    it('should return access_token and user on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'user-uuid-1',
        username: 'admin1',
        email: 'admin@example.com',
        role: 'ADMIN',
        passwordHash: hashedPassword,
        deletedAt: null,
        tenantId: 'tenant-uuid-1',
      };

      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.user.username).toBe('admin1');
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.tenantId).toBe('tenant-uuid-1');
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          username: 'admin1',
          sub: 'user-uuid-1',
          role: 'ADMIN',
          tenantId: 'tenant-uuid-1',
        },
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByUsernameOrEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      usersService.findByUsernameOrEmail.mockResolvedValue({
        id: 'user-uuid-1',
        username: 'admin1',
        role: 'ADMIN',
        email: 'admin@example.com',
        passwordHash: hashedPassword,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return same error for wrong username and wrong password (prevents user enumeration)', async () => {
      usersService.findByUsernameOrEmail.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');

      const hashedPassword = await bcrypt.hash('differentpassword', 10);
      usersService.findByUsernameOrEmail.mockResolvedValue({
        id: 'user-uuid-1',
        username: 'admin1',
        role: 'ADMIN',
        email: 'admin@example.com',
        passwordHash: hashedPassword,
      });
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should create a refresh token on successful login', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      usersService.findByUsernameOrEmail.mockResolvedValue({
        id: 'user-uuid-1',
        username: 'admin1',
        role: 'ADMIN',
        passwordHash: hashedPassword,
        tenantId: 'tenant-uuid-1',
      });

      await service.login(loginDto);

      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-uuid-1',
            token: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('refreshAccessToken', () => {
    const mockValidToken = {
      id: 'rt-1',
      token: 'valid-refresh-token',
      userId: 'user-uuid-1',
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
      revokedAt: null,
      user: {
        id: 'user-uuid-1',
        username: 'admin1',
        role: 'ADMIN',
        tenantId: 'tenant-uuid-1',
      },
    };

    it('should return new tokens when refresh token is valid', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(mockValidToken);

      const result = await service.refreshAccessToken('valid-refresh-token');

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.refresh_token).toBeDefined();
      expect(result.expires_in).toBe(900);
      // Old token should be revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw UnauthorizedException when token does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshAccessToken('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...mockValidToken,
        revokedAt: new Date(),
      });

      await expect(service.refreshAccessToken('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...mockValidToken,
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      });

      await expect(service.refreshAccessToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke all active refresh tokens for the user', async () => {
      const result = await service.logout('user-uuid-1');

      expect(result.message).toBe('Logged out successfully');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid-1', revokedAt: null },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
