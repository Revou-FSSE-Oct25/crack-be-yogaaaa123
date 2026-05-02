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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Tambah produk baru (Admin only)',
    description: `
Menambahkan produk baru ke database.

**Field wajib:** sku, name, price
**Field optional:** description, stockQuantity, reorderLevel, categoryId, supplierId

Harga menggunakan string desimal untuk presisi (Prisma.Decimal).
    `,
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Produk berhasil dibuat' })
  @ApiResponse({ status: 409, description: 'Conflict — SKU sudah terdaftar' })
  create(@Body() createProductDto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(createProductDto, user.tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar semua produk (dengan search & filter)',
    description: `
Mendapatkan daftar produk dengan berbagai filter:

**Pencarian:** gunakan parameter \`search\` untuk mencari berdasarkan nama atau SKU
**Filter:** \`categoryId\`, \`supplierId\`
**Pagination:** \`skip\` dan \`take\` (default take: 50)
    `,
  })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Data yang dilewati' })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Jumlah data diambil (default: 50)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Cari berdasarkan nama atau SKU',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by kategori',
  })
  @ApiQuery({
    name: 'supplierId',
    required: false,
    type: String,
    description: 'Filter by supplier',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar produk',
    schema: {
      example: {
        data: [
          {
            id: 'uuid-1',
            sku: 'SKU-1001',
            name: 'iPhone 15',
            price: '999.99',
            stockQuantity: 50,
            category: { name: 'Electronics' },
            supplier: { name: 'Tech Corp' },
          },
        ],
        total: 1,
      },
    },
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.productsService.findAll(user.tenantId, {
      skip: skip !== undefined ? parseInt(skip, 10) : undefined,
      take: take !== undefined ? parseInt(take, 10) : undefined,
      search,
      categoryId: categoryId || undefined,
      supplierId: supplierId || undefined,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail produk by ID',
    description: 'Mendapatkan detail lengkap produk termasuk kategori, supplier, dan harga.',
  })
  @ApiResponse({ status: 200, description: 'Detail produk' })
  @ApiResponse({ status: 404, description: 'Produk tidak ditemukan' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({ summary: 'Update produk (Admin only)' })
  @ApiBody({ type: UpdateProductDto })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.update(id, updateProductDto, user.tenantId);
  }

  @Delete(':id')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Hapus produk (Admin only)',
    description: 'Menghapus produk dari database. **Peringatan:** tidak bisa undo.',
  })
  @ApiResponse({ status: 200, description: 'Produk berhasil dihapus' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.remove(id, user.tenantId);
  }
}
