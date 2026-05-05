import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles.constant';
import { AdminService } from './admin.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ── DTO ──────────────────────────────────────────────────────────────

class AdminLoginDto {
  @ApiProperty({ example: 'superadmin@crack.com', description: 'Email super admin' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SuperAdmin@123', description: 'Password super admin' })
  @IsString()
  @MinLength(8)
  password!: string;
}

// ── CONTROLLER ───────────────────────────────────────────────────────

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  private readonly ACCESS_TOKEN_EXPIRES = '15m';
  private readonly REFRESH_TOKEN_EXPIRES_DAYS = 7;

  constructor(
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ── AUTH ───────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Login Super Admin — endpoint khusus developer',
    description: `
Login khusus untuk Super Admin (developer/pemilik platform).

**Akses:**
- Endpoint ini TERPISAH dari login user biasa
- Hanya bisa login dengan email + password super admin
- Rate limit: 5 percobaan per 60 detik

**Akun default (seed):**
- Email: superadmin@crack.com
- Password: SuperAdmin@123
    `,
  })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({ status: 200, description: 'Login berhasil' })
  @ApiResponse({ status: 401, description: 'Email atau password salah' })
  async login(@Body() dto: AdminLoginDto) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const payload = {
      sub: admin.id,
      username: admin.email,
      role: ROLES.SUPER_ADMIN,
      isSuperAdmin: true,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES,
    });

    return {
      access_token,
      expires_in: 900,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: ROLES.SUPER_ADMIN,
        isSuperAdmin: true,
      },
    };
  }

  // ── TENANTS ────────────────────────────────────────────────────────

  @Get('tenants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Daftar semua tenant (toko) — Super Admin only',
    description: `
Mendapatkan daftar semua toko yang terdaftar di platform.

**Data yang ditampilkan:**
- Nama toko, slug
- Tanggal daftar
- Jumlah user, produk, pesanan (ANGKA SAJA — bukan data detail)

**Akses:** SUPER_ADMIN ONLY
    `,
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Daftar tenant' })
  findAllTenants(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.adminService.findAllTenants(
      skip !== undefined ? parseInt(skip, 10) : undefined,
      take !== undefined ? parseInt(take, 10) : undefined,
    );
  }

  @Get('tenants/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Detail tenant by ID — Super Admin only',
    description: `
Detail satu toko. Hanya menampilkan data platform:
- Nama, slug, tanggal daftar
- Statistik agregat (jumlah user, produk, dll — ANGKA SAJA)
- Informasi owner (email, nama)

**TIDAK menampilkan data bisnis seperti daftar produk, transaksi, dll.**
    `,
  })
  @ApiResponse({ status: 200, description: 'Detail tenant' })
  @ApiResponse({ status: 404, description: 'Tenant tidak ditemukan' })
  findTenantById(@Param('id') id: string) {
    return this.adminService.findTenantById(id);
  }

  @Delete('tenants/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Hapus tenant (soft delete) — Super Admin only',
    description: `
Soft delete tenant beserta semua data terkait:
- User, produk, kategori, supplier
- Sales order, purchase order
- Data tidak hilang permanen (hanya di-set deletedAt)

**Akses:** SUPER_ADMIN ONLY — HATI-HATI! Ini menghapus semua data toko.
    `,
  })
  @ApiResponse({ status: 200, description: 'Tenant berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Tenant tidak ditemukan' })
  removeTenant(@Param('id') id: string) {
    return this.adminService.removeTenant(id);
  }

  // ── STATISTICS ─────────────────────────────────────────────────────

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Statistik platform — Super Admin only',
    description: `
Statistik agregat seluruh platform:
- Total tenant (toko)
- Total user
- Total produk
- Total sales order
- Total purchase order
- Total return

**Hanya angka agregat — TIDAK ada data detail per toko.**
    `,
  })
  @ApiResponse({ status: 200, description: 'Statistik platform' })
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }
}
