import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ACCESS_TOKEN_EXPIRES = '15m'; // 15 menit
  private readonly REFRESH_TOKEN_EXPIRES_DAYS = 7; // 7 hari

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByUsernameOrEmail(loginDto.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId,
    };

    // Generate access token dengan expiry
    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES,
    });

    // Generate refresh token
    const refresh_token = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    // Simpan refresh token ke database
    await this.prisma.refreshToken.create({
      data: {
        token: refresh_token,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    this.logger.log(`User ${user.username} logged in successfully`);

    return {
      access_token,
      refresh_token,
      expires_in: 900, // 15 menit dalam detik
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    // Cari refresh token yang valid dan belum expired
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new access token
    const payload = {
      username: storedToken.user.username,
      sub: storedToken.user.id,
      role: storedToken.user.role,
      tenantId: storedToken.user.tenantId,
    };

    const newAccessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES,
    });

    // Generate new refresh token
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 900,
    };
  }

  async register(registerDto: RegisterDto) {
    const { storeName, username, email, password, displayName } = registerDto;

    // ── CEK DUPLIKAT ──────────────────────────────────────────────
    // Cek apakah email platform user sudah terdaftar
    const existingPlatformUser = await this.prisma.platformUser.findUnique({
      where: { email },
    });
    if (existingPlatformUser) {
      throw new ConflictException('Email sudah terdaftar');
    }

    // Cek apakah slug tenant sudah dipakai
    const slug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      throw new ConflictException('Nama toko sudah terdaftar');
    }

    // Cek apakah username sudah dipakai di tenant manapun
    // (username unique per tenant, tapi kita cek global untuk UX yang lebih baik)
    const existingUsername = await this.prisma.tenantUser.findFirst({
      where: { username },
    });
    if (existingUsername) {
      throw new ConflictException('Username sudah terdaftar');
    }

    // ── HASH PASSWORD ─────────────────────────────────────────────
    const salt = await bcrypt.genSalt(12); // cost factor 12 — lebih aman
    const passwordHash = await bcrypt.hash(password, salt);

    // ── TRANSAKSI ATOMIK ──────────────────────────────────────────
    // Semua atau tidak sama sekali — jika gagal di tengah, rollback total
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Buat Platform User
      const platformUser = await tx.platformUser.create({
        data: {
          email,
          name: displayName || username,
          passwordHash,
        },
      });

      // 2. Buat Tenant (Toko)
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug,
        },
      });

      // 3. Buat Tenant Member (hubungkan platform user ke tenant sebagai OWNER)
      await tx.tenantMember.create({
        data: {
          role: 'OWNER',
          platformUserId: platformUser.id,
          tenantId: tenant.id,
        },
      });

      // 4. Buat Tenant User (admin toko)
      const tenantUser = await tx.tenantUser.create({
        data: {
          username,
          passwordHash,
          role: 'ADMIN',
          displayName: displayName || username,
          tenantId: tenant.id,
        },
      });

      return { platformUser, tenant, tenantUser };
    });

    this.logger.log(
      `New registration: store="${result.tenant.name}", user="${result.tenantUser.username}"`,
    );

    // ── GENERATE TOKEN ────────────────────────────────────────────
    const payload = {
      username: result.tenantUser.username,
      sub: result.tenantUser.id,
      role: result.tenantUser.role,
      tenantId: result.tenant.id,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES,
    });

    const refresh_token = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        token: refresh_token,
        userId: result.tenantUser.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      message: 'Registrasi berhasil',
      access_token,
      refresh_token,
      expires_in: 900,
      user: {
        id: result.tenantUser.id,
        username: result.tenantUser.username,
        role: result.tenantUser.role,
        tenantId: result.tenant.id,
        storeName: result.tenant.name,
      },
    };
  }

  async logout(userId: string) {
    // Revoke all active refresh tokens untuk user ini
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`User ${userId} logged out, all refresh tokens revoked`);
    return { message: 'Logged out successfully' };
  }
}
