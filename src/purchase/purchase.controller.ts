import { Controller, Get, Post, Body, Param, UseGuards, Query, Patch } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseOrderDto, PurchaseOrderItemDto } from './dto/create-purchase-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantRole, PurchaseOrderStatus } from '@prisma/client';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('purchase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Buat purchase order langsung (RECEIVED — langsung tambah stok) - Admin only',
    description: `
Membuat purchase order dengan status RECEIVED.

**Proses:**
1. Buat purchase order dengan status RECEIVED
2. Tambah stok setiap produk secara otomatis
3. Update average cost produk (weighted average)
4. Catat transaksi inventory

**Akses:** ADMIN ONLY
    `,
  })
  @ApiBody({ type: CreatePurchaseOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Purchase order berhasil dibuat',
    schema: {
      example: {
        id: 'uuid-po-1',
        orderNumber: 'PO-2001',
        status: 'RECEIVED',
        totalPrice: 40000.0,
        supplier: { name: 'Tech Corp' },
      },
    },
  })
  createPurchaseOrder(
    @Body() createDto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseService.createPurchaseOrder({
      ...createDto,
      userId: user.id,
      tenantId: user.tenantId,
    });
  }

  @Post('pending')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Buat purchase order PENDING (tidak tambah stok) - Admin only',
    description: `
Membuat purchase order dengan status PENDING.

**Kapan pakai ini?**
- Pesanan ke supplier yang belum diterima
- Proses receive dilakukan nanti via PATCH /:id/receive

**Akses:** ADMIN ONLY
    `,
  })
  @ApiBody({ type: CreatePurchaseOrderDto })
  @ApiResponse({ status: 201, description: 'Pending purchase order berhasil dibuat' })
  createPendingPurchaseOrder(
    @Body() createDto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseService.createPendingPurchaseOrder({
      ...createDto,
      userId: user.id,
      tenantId: user.tenantId,
    });
  }

  @Patch(':id/receive')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Terima purchase order (PENDING → RECEIVED, tambah stok) - Admin only',
    description: `
Menerima pesanan dari supplier.

**Proses:**
1. Ubah status PENDING → RECEIVED
2. Tambah stok setiap produk
3. Update average cost
4. Catat transaksi inventory

**Akses:** ADMIN ONLY
    `,
  })
  @ApiResponse({ status: 200, description: 'Purchase order berhasil diterima' })
  receivePurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseService.receivePurchaseOrder(id, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Ambil semua purchase orders (dengan filter) - Admin only',
    description: `
Mendapatkan daftar purchase order dengan berbagai filter.

**Filter:**
- \`supplierId\` — filter by supplier
- \`status\` — PENDING / RECEIVED / CANCELLED
- \`skip\` / \`take\` — pagination

**Akses:** ADMIN ONLY
    `,
  })
  @ApiQuery({ name: 'supplierId', required: false, type: String })
  @ApiQuery({ name: 'status', enum: PurchaseOrderStatus, required: false })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getPurchaseOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: PurchaseOrderStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.purchaseService.getPurchaseOrders(user.tenantId, {
      supplierId: supplierId ? supplierId : undefined,
      status,
      skip: skip !== undefined ? parseInt(skip, 10) : undefined,
      take: take !== undefined ? parseInt(take, 10) : undefined,
    });
  }

  @Get('supplier-summary/:supplierId')
  @ApiOperation({
    summary: 'Ringkasan pembelian dari supplier tertentu - Admin only',
    description: 'Mendapatkan total pembelian, jumlah PO, dan statistik dari satu supplier.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ringkasan supplier',
    schema: {
      example: {
        supplierName: 'Tech Corp',
        totalOrders: 5,
        totalSpent: 150000.0,
        lastOrderDate: '2026-04-28T10:00:00Z',
      },
    },
  })
  getSupplierSummary(
    @Param('supplierId') supplierId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseService.getSupplierPurchaseSummary(user.tenantId, supplierId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ambil detail purchase order by ID' })
  getPurchaseOrderById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseService.getPurchaseOrderById(user.tenantId, id);
  }

  @Patch(':id/cancel')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Batalkan purchase order PENDING (Admin only)',
    description: `
Membatalkan purchase order yang masih PENDING.

**Catatan:** Hanya PO dengan status PENDING yang bisa dibatalkan.
PO yang sudah RECEIVED tidak bisa dibatalkan.

**Akses:** ADMIN ONLY
    `,
  })
  @ApiResponse({ status: 200, description: 'Purchase order berhasil dibatalkan' })
  cancelPurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseService.cancelPurchaseOrder(id, user.tenantId);
  }
}
