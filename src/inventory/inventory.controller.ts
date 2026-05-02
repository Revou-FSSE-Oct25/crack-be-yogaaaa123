import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjust')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Adjust stok manual (Admin only)',
    description: `
Adjust stok produk secara manual. Biasanya untuk koreksi stok.

**Aturan:**
- quantityChange POSITIVE → nambah stok
- quantityChange NEGATIVE → ngurangin stok
- quantityChange TIDAK BOLEH 0!
- type: pilih jenis transaksi (ADJUSTMENT, DAMAGED, LOST, FOUND, MANUAL)

**Akses:** ADMIN ONLY
    `,
  })
  @ApiBody({ type: AdjustStockDto })
  @ApiResponse({ status: 201, description: 'Stok berhasil diadjust' })
  @ApiResponse({ status: 400, description: 'Bad Request — stok tidak cukup untuk pengurangan' })
  adjustStock(@Body() adjustStockDto: AdjustStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.adjustStock(
      adjustStockDto.productId,
      user.id,
      user.tenantId,
      adjustStockDto.quantityChange,
      adjustStockDto.type,
      adjustStockDto.referenceId,
      adjustStockDto.notes,
    );
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Produk dengan stok menipis (below reorder level)',
    description: `
Mendapatkan daftar produk yang stoknya sudah di bawah reorder level.
Berguna untuk restock alert di dashboard.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar produk low stock',
    schema: {
      example: [
        { id: 'uuid', name: 'iPhone 15', sku: 'SKU-1001', stockQuantity: 3, reorderLevel: 10 },
      ],
    },
  })
  getLowStockProducts(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.getLowStockProducts(user.tenantId);
  }

  @Get('check-reorder/:productId')
  @ApiOperation({
    summary: 'Cek apakah produk tertentu perlu re-order',
    description: 'Mengecek stok produk vs reorder level. Return status dan saran quantity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status reorder produk',
    schema: {
      example: {
        productName: 'iPhone 15',
        currentStock: 3,
        reorderLevel: 10,
        needsReorder: true,
        suggestedOrderQty: 7,
      },
    },
  })
  checkReorderLevel(@Param('productId') productId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.checkReorderLevel(productId, user.tenantId);
  }
}
