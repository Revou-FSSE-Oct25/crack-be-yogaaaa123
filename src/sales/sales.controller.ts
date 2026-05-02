import { Controller, Get, Post, Body, Param, UseGuards, Query, Patch } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { SalesOrderStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({
    summary: 'Buat transaksi penjualan langsung (COMPLETED)',
    description: 'Membuat sales order dengan status COMPLETED. Langsung kurangi stok.',
  })
  @ApiBody({ type: CreateSalesOrderDto })
  @ApiResponse({ status: 201, description: 'Sales order berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  createSalesOrder(@Body() createDto: CreateSalesOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.createSalesOrder({
      ...createDto,
      userId: user.id,
      tenantId: user.tenantId,
    });
  }

  @Post('pending')
  @ApiOperation({
    summary: 'Buat transaksi penjualan PENDING (tidak kurangi stok)',
    description: 'Membuat sales order dengan status PENDING. Tidak mengurangi stok.',
  })
  @ApiBody({ type: CreateSalesOrderDto })
  @ApiResponse({ status: 201, description: 'Pending sales order berhasil dibuat' })
  createPendingSalesOrder(
    @Body() createDto: CreateSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.createPendingSalesOrder({
      ...createDto,
      userId: user.id,
      tenantId: user.tenantId,
    });
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Konfirmasi / complete pending sales order',
    description: 'Mengubah status PENDING -> COMPLETED. Langsung kurangi stok.',
  })
  @ApiResponse({ status: 200, description: 'Sales order berhasil di-complete' })
  @ApiResponse({ status: 404, description: 'Sales order tidak ditemukan' })
  @ApiResponse({ status: 400, description: 'Stok tidak cukup atau order sudah COMPLETED' })
  completeSalesOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.completeSalesOrder(id, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Ambil semua sales orders (dengan filter)',
    description: 'Mendapatkan daftar sales order dengan berbagai filter.',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SalesOrderStatus })
  @ApiResponse({ status: 200, description: 'Daftar sales orders' })
  getSalesOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: SalesOrderStatus,
  ) {
    return this.salesService.getSalesOrders(user.tenantId, {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      customerId,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ambil detail sales order by ID' })
  @ApiResponse({ status: 200, description: 'Detail sales order' })
  @ApiResponse({ status: 404, description: 'Sales order tidak ditemukan' })
  getSalesOrderById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.salesService.getSalesOrderById(user.tenantId, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Batalkan PENDING sales order',
    description: 'Hanya PENDING orders yang bisa dibatalkan. Tidak ada dampak stok.',
  })
  @ApiResponse({ status: 200, description: 'Sales order berhasil dibatalkan' })
  @ApiResponse({ status: 404, description: 'Sales order tidak ditemukan' })
  @ApiResponse({ status: 400, description: 'Hanya PENDING orders yang bisa dibatalkan' })
  cancelSalesOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.cancelSalesOrder(id, user.tenantId);
  }
}
