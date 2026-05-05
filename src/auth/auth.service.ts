import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** Maksimum percobaan login gagal sebelum akun dikunci */
const MAX_FAILED_ATTEMPTS = 5;
/** Durasi penguncian akun dalam menit setelah melebihi batas */
const LOCK_DURATION_MINUTES = 30;

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

    // ── BRUTE FORCE CHECK ──────────────────────────────────────────
    if (this.isAccountLocked(user.lockedUntil)) {
      const remainingMinutes = Math.ceil((user.lockedUntil!.getTime() - Date.now()) / 60000);
      this.logger.warn(
        `Login blocked: user ${user.username} is locked for ${remainingMinutes} more minutes`,
      );
      throw new ForbiddenException(
        `Account is temporarily locked. Please try again in ${remainingMinutes} minutes.`,
      );
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      // ── TRACK FAILED ATTEMPTS ──────────────────────────────────
      await this.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // ── RESET ON SUCCESS ───────────────────────────────────────────
    if (user.failedLoginAttempts > 0) {
      await this.prisma.tenantUser.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
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

    // Generate refresh token — SIMPAN HASH, KEMBALIKAN RAW
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const hashedRefreshToken = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    // Simpan HASH refresh token ke database
    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    this.logger.log(`User ${user.username} logged in successfully`);

    return {
      accessToken: access_token,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    // Hash token yang masuk untuk pencocokan database
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Cari refresh token yang valid dan belum expired
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
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

    // Generate new refresh token — SIMPAN HASH, KEMBALIKAN RAW
    const newRawToken = crypto.randomBytes(40).toString('hex');
    const newHashedToken = crypto.createHash('sha256').update(newRawToken).digest('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        token: newHashedToken,
        userId: storedToken.user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawToken,
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
    const existingUsername = await this.prisma.tenantUser.findFirst({
      where: { username },
    });
    if (existingUsername) {
      throw new ConflictException('Username sudah terdaftar');
    }

    // ── HASH PASSWORD ─────────────────────────────────────────────
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // ── TRANSAKSI ATOMIK ──────────────────────────────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      const platformUser = await tx.platformUser.create({
        data: {
          email,
          name: displayName || username,
          passwordHash,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug,
        },
      });

      await tx.tenantMember.create({
        data: {
          role: 'OWNER',
          platformUserId: platformUser.id,
          tenantId: tenant.id,
        },
      });

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

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const hashedRefreshToken = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId: result.tenantUser.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      message: 'Registrasi berhasil',
      accessToken: access_token,
      refreshToken: rawRefreshToken,
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

  // ── PRIVATE HELPERS ───────────────────────────────────────────────

  /**
   * Mengecek apakah akun sedang terkunci berdasarkan timestamp lockedUntil.
   */
  private isAccountLocked(lockedUntil: Date | null): boolean {
    if (!lockedUntil) return false;
    return new Date() < lockedUntil;
  }

  /**
   * Mencatat percobaan login gagal. Jika melebihi batas, kunci akun.
   *
   * Logika:
   * 1. Increment failedLoginAttempts
   * 2. Jika mencapai MAX_FAILED_ATTEMPTS, set lockedUntil = now + LOCK_DURATION
   * 3. Reset counter jika window waktu sudah berlalu (reset ke 1)
   */
  private async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.prisma.tenantUser.findUnique({
      where: { id: userId },
      select: { id: true, failedLoginAttempts: true, lockedUntil: true },
    });

    if (!user) return;

    const newAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      newAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
        : null;

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil,
      },
    });

    if (lockedUntil) {
      this.logger.warn(
        `Account ${userId} locked for ${LOCK_DURATION_MINUTES} minutes after ${newAttempts} failed attempts`,
      );
    }
  }
}
