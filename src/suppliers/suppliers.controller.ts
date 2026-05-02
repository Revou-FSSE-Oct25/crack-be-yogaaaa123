import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
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

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(TenantRole.ADMIN)
  @ApiOperation({ summary: 'Tambah supplier baru (Admin only)' })
  @ApiBody({ type: CreateSupplierDto })
  @ApiResponse({ status: 201, description: 'Supplier berhasil dibuat' })
  create(@Body() createSupplierDto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.create(createSupplierDto, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar semua supplier (dengan pagination)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.suppliersService.findAll(
      user.tenantId,
      skip !== undefined ? parseInt(skip, 10) : undefined,
      take !== undefined ? parseInt(take, 10) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail supplier by ID' })
  @ApiResponse({ status: 200, description: 'Detail supplier' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({ summary: 'Update supplier (Admin only)' })
  @ApiBody({ type: UpdateSupplierDto })
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.update(id, updateSupplierDto, user.tenantId);
  }

  @Delete(':id')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({ summary: 'Hapus supplier (Admin only)' })
  @ApiResponse({ status: 200, description: 'Supplier berhasil dihapus' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.remove(id, user.tenantId);
  }
}
