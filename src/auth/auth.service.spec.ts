import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUsersService = () => ({
  findByUsername: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: ReturnType<typeof mockUsersService>;
  let jwtService: ReturnType<typeof mockJwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useFactory: mockUsersService },
        { provide: JwtService, useFactory: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
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
      };

      usersService.findByUsername.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.user.username).toBe('admin1');
      expect(result.user.role).toBe('ADMIN');
      expect(jwtService.sign).toHaveBeenCalledWith({
        username: 'admin1',
        sub: 'user-uuid-1',
        role: 'ADMIN',
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      usersService.findByUsername.mockResolvedValue({
        id: 'user-uuid-1',
        username: 'admin1',
        role: 'ADMIN',
        passwordHash: hashedPassword,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return same error for wrong username and wrong password (prevents user enumeration)', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');

      const hashedPassword = await bcrypt.hash('differentpassword', 10);
      usersService.findByUsername.mockResolvedValue({
        id: 'user-uuid-1',
        username: 'admin1',
        role: 'ADMIN',
        passwordHash: hashedPassword,
      });
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });
  });
});
