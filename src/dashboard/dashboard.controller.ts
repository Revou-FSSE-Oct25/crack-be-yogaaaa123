import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary (counts, revenue, low stock)' })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top selling products' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopProducts(@Query('limit') limit?: string) {
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
    return this.dashboardService.getTopProducts(limitNum);
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Get sales trend over last N days' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getSalesTrend(@Query('days') days?: string) {
    const daysNum = days !== undefined ? parseInt(days, 10) : 30;
    return this.dashboardService.getSalesTrend(daysNum);
  }

  @Get('inventory-value')
  @ApiOperation({ summary: 'Get total inventory value' })
  getInventoryValue() {
    return this.dashboardService.getInventoryValue();
  }
}
