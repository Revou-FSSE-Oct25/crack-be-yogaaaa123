import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantRole } from '@prisma/client';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buat user baru (Admin only)',
    description: `
Membuat user baru (Admin atau Staff).

**Data yang dibutuhkan:**
- username (min 3 karakter)
- email (valid email)
- password (min 6 karakter)
- role (optional, default STAFF): ADMIN atau STAFF

**Akses:** ADMIN ONLY
    `,
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User berhasil dibuat',
    schema: {
      example: { id: 'uuid', username: 'johndoe', email: 'john@example.com', role: 'STAFF' },
    },
  })
  @ApiResponse({ status: 409, description: 'Conflict — username atau email sudah terdaftar' })
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.create(createUserDto, user.tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Daftar semua users (Admin only)',
    description: 'Mendapatkan daftar semua user dengan pagination. Hanya ADMIN yang bisa akses.',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Daftar users' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.usersService.findAll(
      user.tenantId,
      skip !== undefined ? parseInt(skip, 10) : undefined,
      take !== undefined ? parseInt(take, 10) : undefined,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detail user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Detail user' })
  @ApiResponse({ status: 404, description: 'User tidak ditemukan' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user (Admin only)',
    description: 'Update email dan/atau role user. Admin-only.',
  })
  @ApiBody({ type: UpdateUserDto })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(id, updateUserDto, user.tenantId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft delete user (Admin only)',
    description: 'Soft delete: set deletedAt timestamp. User tidak bisa login lagi.',
  })
  @ApiResponse({ status: 200, description: 'User berhasil dihapus (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(id, user.tenantId);
  }

  @Patch(':id/change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ganti password sendiri (authenticated users only)',
    description: `
**PENTING:** User hanya bisa ganti password mereka SENDIRI.
- Kirim currentPassword + newPassword
- currentPassword harus benar
- newPassword minimal 8 karakter

**Admin yang perlu reset password user lain:** gunakan fitur create user.
    `,
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password berhasil diubah' })
  @ApiResponse({ status: 400, description: 'Password salah atau tidak valid' })
  @ApiResponse({ status: 403, description: 'Forbidden: hanya bisa ganti password sendiri' })
  changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Ensure user can only change their own password
    // (Admins who need to reset can use the create flow)
    if (user.id !== id) {
      throw new ForbiddenException('Forbidden: you can only change your own password');
    }
    return this.usersService.changePassword(id, changePasswordDto);
  }
}
