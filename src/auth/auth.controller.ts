import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Register toko baru — auto-create tenant + admin user',
    description: `
Daftarkan toko baru. Sistem akan otomatis:
1. Membuat Platform User (untuk login global / recovery)
2. Membuat Tenant (toko) baru
3. Membuat Tenant Member (hubungan platform user ke toko sebagai OWNER)
4. Membuat Tenant User (admin toko) dengan role ADMIN
5. Mengembalikan JWT token langsung (langsung login)

**Security:**
- Password minimal 8 karakter, harus ada huruf besar, huruf kecil, dan angka
- Username hanya huruf/angka/underscore
- Email unique — tidak bisa daftar 2x dengan email sama
- Nama toko unique — tidak bisa daftar 2x dengan nama toko sama
- Rate limit: 5 percobaan per 60 detik (mencegah spam registrasi)
- Password di-hash dengan bcrypt cost factor 12
- Semua operasi dalam 1 transaksi atomik (gagal satu, gagal semua)
    `,
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Registrasi berhasil',
    schema: {
      example: {
        message: 'Registrasi berhasil',
        access_token: 'eyJhbGciOiJIUzI1NiIs...',
        refresh_token: 'a1b2c3d4e5f6...',
        expires_in: 900,
        user: {
          id: 'uuid-user-1',
          username: 'admin',
          role: 'ADMIN',
          tenantId: 'uuid-tenant-1',
          storeName: 'Toko Sembako Makmur',
        },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Conflict — email/username/nama toko sudah terdaftar' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'User login — mendapatkan JWT access + refresh token',
    description: `
Login dengan username dan password.

**Cara kerja:**
1. Kirim username + password
2. Server validasi kredensial
3. Dapatkan access_token (JWT, berlaku 15 menit) + refresh_token (berlaku 7 hari)
4. Gunakan access_token di header Authorization
5. Saat access_token expire, gunakan /auth/refresh untuk dapatkan token baru

**Akun default (seed):**
- Admin: \`admin1\` / \`password123\`
- Staff: \`staff1\` / \`password123\`

**Rate Limit:** 10 percobaan per 60 detik (mencegah brute force)
    `,
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login berhasil',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIs...',
        refresh_token: 'a1b2c3d4e5f6...',
        expires_in: 900,
        user: {
          id: 'uuid-user-1',
          username: 'admin1',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token menggunakan refresh token',
    description: `
Kirim refresh_token yang valid untuk mendapatkan access_token baru.

**Cara kerja:**
1. Refresh token lama akan di-revoke (token rotation — security best practice)
2. Dapatkan access_token + refresh_token baru
3. Refresh token berlaku 7 hari

Rate limit: 5 requests per 60 detik.
    `,
  })
  @Throttle({ refresh: { ttl: 60000, limit: 5 } })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Headers('x-refresh-token') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required in x-refresh-token header');
    }
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout — revoke semua refresh token user',
    description: 'Revoke semua refresh token aktif untuk user yang sedang login.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }
}
