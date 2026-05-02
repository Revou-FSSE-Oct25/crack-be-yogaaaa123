import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
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
  ApiResponse,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(TenantRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({
    summary: 'Laporan penjualan',
    description: `
Mendapatkan laporan penjualan lengkap dengan filter tanggal.

**Data per transaksi:**
- orderNumber, status, totalPrice, totalCogs, totalProfit
- User yang memproses
- Tanggal transaksi
- Jumlah item terjual

**Filter:** \`startDate\` dan \`endDate\` (format YYYY-MM-DD)

**Akses:** ADMIN ONLY
    `,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Tanggal mulai (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Tanggal akhir (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Laporan penjualan',
    schema: {
      example: {
        data: [
          {
            orderNumber: 'SO-1001',
            status: 'COMPLETED',
            totalPrice: 1999.98,
            totalProfit: 399.98,
            user: { username: 'admin1' },
            createdAt: '2026-05-01T10:00:00Z',
            items: [{ product: { name: 'iPhone 15' }, quantity: 2, unitPrice: 999.99 }],
          },
        ],
        summary: { totalRevenue: 1999.98, totalProfit: 399.98, totalOrders: 1 },
      },
    },
  })
  getSalesReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getSalesReport(user.tenantId, startDate, endDate);
  }

  @Get('inventory')
  @ApiOperation({
    summary: 'Laporan inventory',
    description: `
Mendapatkan laporan stok semua produk.

**Data per produk:**
- SKU, nama, kategori, supplier
- Stok saat ini, reorder level
- Average cost, total nilai (cost × stok)
- Status rekomendasi re-order

**Akses:** ADMIN ONLY
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Laporan inventory',
    schema: {
      example: {
        data: [
          {
            sku: 'SKU-1001',
            name: 'iPhone 15',
            stockQuantity: 50,
            reorderLevel: 10,
            averageCost: 800.0,
            totalValue: 40000.0,
            needsReorder: false,
            category: { name: 'Electronics' },
          },
        ],
      },
    },
  })
  getInventoryReport(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getInventoryReport(user.tenantId);
  }

  @Get('profit-loss')
  @ApiOperation({
    summary: 'Laporan laba/rugi (Profit & Loss)',
    description: `
Mendapatkan laporan laba rugi dalam periode tertentu.

**Komponen:**
- Total Revenue — semua penjualan
- Total COGS — harga pokok penjualan
- Total Profit — laba kotor
- Gross Margin — persentase laba

**Filter:** \`startDate\` dan \`endDate\` (format YYYY-MM-DD)

**Akses:** ADMIN ONLY
    `,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Tanggal mulai (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Tanggal akhir (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Laporan laba rugi',
    schema: {
      example: {
        totalRevenue: 50000000,
        totalCogs: 35000000,
        totalProfit: 15000000,
        grossMargin: 30,
        period: { startDate: '2026-01-01', endDate: '2026-05-01' },
      },
    },
  })
  getProfitLoss(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getProfitLoss(user.tenantId, startDate, endDate);
  }

  @Get('sales/csv')
  @ApiOperation({
    summary: 'Export laporan penjualan ke CSV (download)',
    description: `
Download laporan penjualan dalam format CSV.

**Cara pakai di browser:** langsung buka URL ini → auto download file sales-report.csv
Atau pake \`fetch()\` dengan header Authorization.

**Filter:** \`startDate\` dan \`endDate\`
    `,
  })
  @ApiProduces('text/csv')
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportSalesCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.reportsService.exportSalesCsv(user.tenantId, startDate, endDate);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
    res.send(csv);
  }

  @Get('inventory/csv')
  @ApiOperation({
    summary: 'Export laporan inventory ke CSV (download)',
    description: 'Download semua data inventory dalam format CSV.',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportInventoryCsv(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const csv = await this.reportsService.exportInventoryCsv(user.tenantId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.csv"');
    res.send(csv);
  }

  @Get('profit-loss/csv')
  @ApiOperation({
    summary: 'Export laporan laba/rugi ke CSV (download)',
    description: 'Download laporan profit & loss dalam format CSV.',
  })
  @ApiProduces('text/csv')
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportProfitLossCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.reportsService.exportProfitLossCsv(user.tenantId, startDate, endDate);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="profit-loss-report.csv"');
    res.send(csv);
  }
}
