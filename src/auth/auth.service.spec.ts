import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';

const createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-uuid-1',
  username: 'admin1',
  email: 'admin@example.com',
  role: 'ADMIN',
  passwordHash: '',
  deletedAt: null,
  tenantId: 'tenant-uuid-1',
  failedLoginAttempts: 0,
  lockedUntil: null,
  ...overrides,
});

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
  tenantUser: {
    update: jest.fn(),
    findUnique: jest.fn(),
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
      const mockUser = createMockUser({ passwordHash: hashedPassword });

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
      const mockUser = createMockUser({ passwordHash: hashedPassword });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return same error for wrong username and wrong password', async () => {
      usersService.findByUsernameOrEmail.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');

      const hashedPassword = await bcrypt.hash('differentpassword', 10);
      usersService.findByUsernameOrEmail.mockResolvedValue(
        createMockUser({ passwordHash: hashedPassword }),
      );
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should create a refresh token on successful login', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = createMockUser({ passwordHash: hashedPassword });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

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

    it('should hash the refresh token before storing (SHA-256)', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = createMockUser({ passwordHash: hashedPassword });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.refresh_token).toHaveLength(80);
      const storedToken = prisma.refreshToken.create.mock.calls[0][0].data.token;
      expect(storedToken).toHaveLength(64);
      expect(storedToken).not.toBe(result.refresh_token);
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.refresh_token)
        .digest('hex');
      expect(storedToken).toBe(expectedHash);
    });

    it('should reset failedLoginAttempts on successful login', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = createMockUser({
        passwordHash: hashedPassword,
        failedLoginAttempts: 3,
      });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

      await service.login(loginDto);

      expect(prisma.tenantUser.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('should block login when account is locked', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const lockedUntil = new Date(Date.now() + 20 * 60 * 1000);
      const mockUser = createMockUser({
        passwordHash: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil,
      });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should allow login after lock period expires', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const lockedUntil = new Date(Date.now() - 5 * 60 * 1000);
      const mockUser = createMockUser({
        passwordHash: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil,
      });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);
      expect(result.access_token).toBe('mock.jwt.token');
    });

    it('should track failed attempts on wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const mockUser = createMockUser({
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
      });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);
      prisma.tenantUser.findUnique.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');

      expect(prisma.tenantUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          data: expect.objectContaining({ failedLoginAttempts: 1 }),
        }),
      );
    });

    it('should lock account after MAX_FAILED_ATTEMPTS', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const mockUser = createMockUser({
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
      });
      usersService.findByUsernameOrEmail.mockResolvedValue(mockUser);

      for (let i = 1; i <= 5; i++) {
        prisma.tenantUser.findUnique.mockResolvedValue({
          id: 'user-uuid-1',
          failedLoginAttempts: i - 1,
          lockedUntil: null,
        });
        await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      }

      const lastCall = prisma.tenantUser.update.mock.calls[4][0];
      expect(lastCall.data.lockedUntil).toBeDefined();
      expect(lastCall.data.lockedUntil).toBeInstanceOf(Date);
    });
  });

  describe('refreshAccessToken', () => {
    const rawToken = 'valid-refresh-token-1234567890abcdef';
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const mockValidToken = {
      id: 'rt-1',
      token: hashedToken,
      userId: 'user-uuid-1',
      expiresAt: new Date(Date.now() + 86400000),
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

      const result = await service.refreshAccessToken(rawToken);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.refresh_token).toBeDefined();
      expect(result.expires_in).toBe(900);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('should hash incoming token before database lookup', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(mockValidToken);

      await service.refreshAccessToken(rawToken);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: hashedToken } }),
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

      await expect(service.refreshAccessToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...mockValidToken,
        expiresAt: new Date(Date.now() - 86400000),
      });

      await expect(service.refreshAccessToken(rawToken)).rejects.toThrow(
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
