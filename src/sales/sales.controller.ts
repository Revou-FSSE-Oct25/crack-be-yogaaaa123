import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
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
    summary: 'Create a completed sales order (deducts stock immediately)',
  })
  createSalesOrder(
    @Body() createDto: CreateSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.createSalesOrder({
      ...createDto,
      userId: user.id,
    });
  }

  @Post('pending')
  @ApiOperation({
    summary: 'Create a pending sales order (does not deduct stock)',
  })
  createPendingSalesOrder(
    @Body() createDto: CreateSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.createPendingSalesOrder({
      ...createDto,
      userId: user.id,
    });
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete a pending sales order' })
  completeSalesOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.completeSalesOrder(id, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sales orders' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', enum: SalesOrderStatus, required: false })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getSalesOrders(
    @Query('customerId') customerId?: string,
    @Query('status') status?: SalesOrderStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.salesService.getSalesOrders({
      customerId,
      status,
      skip: skip !== undefined ? parseInt(skip, 10) : undefined,
      take: take !== undefined ? parseInt(take, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sales order by id' })
  getSalesOrderById(@Param('id') id: string) {
    return this.salesService.getSalesOrderById(id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cancel a pending sales order (Admin only)' })
  cancelSalesOrder(@Param('id') id: string) {
    return this.salesService.cancelSalesOrder(id);
  }
}
