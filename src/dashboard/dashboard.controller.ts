import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(TenantRole.ADMIN, TenantRole.STAFF)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Ringkasan dashboard — total produk, penjualan, revenue, low stock alert',
    description: `
Menyediakan data ringkasan untuk halaman utama dashboard.

**Data yang dikembalikan:**
- totalProducts — jumlah semua produk
- totalSales — total transaksi penjualan completed
- totalRevenue — total revenue
- totalProfit — total profit
- lowStockCount — jumlah produk yang perlu di-restock
- recentSales — 5 penjualan terakhir

**Akses:** ADMIN dan STAFF
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Ringkasan dashboard',
    schema: {
      example: {
        totalProducts: 150,
        totalSales: 1200,
        totalRevenue: 50000000,
        totalProfit: 10000000,
        lowStockCount: 5,
        recentSales: [
          { orderNumber: 'SO-1001', totalPrice: 999.99, createdAt: '2026-05-01T10:00:00Z' },
        ],
      },
    },
  })
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user.tenantId);
  }

  @Get('top-products')
  @ApiOperation({
    summary: 'Produk terlaris (top selling)',
    description: 'Mendapatkan daftar produk dengan penjualan terbanyak.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Jumlah produk (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top selling products',
    schema: {
      example: [
        { productName: 'iPhone 15', totalSold: 50, revenue: 49999.5 },
        { productName: 'Samsung Galaxy', totalSold: 30, revenue: 29999.7 },
      ],
    },
  })
  getTopProducts(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
    return this.dashboardService.getTopProducts(user.tenantId, limitNum);
  }

  @Get('sales-trend')
  @ApiOperation({
    summary: 'Tren penjualan (N hari terakhir)',
    description: 'Data penjualan per hari untuk grafik di dashboard.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Jumlah hari (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales trend data',
    schema: {
      example: [
        { date: '2026-05-01', totalSales: 5, totalRevenue: 4999.95 },
        { date: '2026-04-30', totalSales: 3, totalRevenue: 2999.97 },
      ],
    },
  })
  getSalesTrend(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    const daysNum = days !== undefined ? parseInt(days, 10) : 30;
    return this.dashboardService.getSalesTrend(user.tenantId, daysNum);
  }

  @Get('inventory-value')
  @ApiOperation({
    summary: 'Total nilai inventory (cost × stok)',
    description:
      'Menghitung total nilai semua inventory berdasarkan average cost × stock quantity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Total inventory value',
    schema: { example: { totalInventoryValue: 25000000 } },
  })
  getInventoryValue(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getInventoryValue(user.tenantId);
  }
}
