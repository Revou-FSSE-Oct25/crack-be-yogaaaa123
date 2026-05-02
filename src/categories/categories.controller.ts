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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
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

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(TenantRole.ADMIN)
  @ApiOperation({ summary: 'Tambah kategori baru (Admin only)' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, description: 'Kategori berhasil dibuat' })
  create(@Body() createCategoryDto: CreateCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.create(createCategoryDto, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar semua kategori (dengan pagination)' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Data yang dilewati' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Jumlah data diambil' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.categoriesService.findAll(
      user.tenantId,
      skip !== undefined ? parseInt(skip, 10) : undefined,
      take !== undefined ? parseInt(take, 10) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail kategori by ID' })
  @ApiResponse({ status: 200, description: 'Detail kategori' })
  @ApiResponse({ status: 404, description: 'Kategori tidak ditemukan' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({ summary: 'Update kategori (Admin only)' })
  @ApiBody({ type: UpdateCategoryDto })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, user.tenantId);
  }

  @Delete(':id')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({ summary: 'Hapus kategori (Admin only)' })
  @ApiResponse({ status: 200, description: 'Kategori berhasil dihapus' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.remove(id, user.tenantId);
  }
}
