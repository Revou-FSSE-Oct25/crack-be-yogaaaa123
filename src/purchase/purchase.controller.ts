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
import { PurchaseService } from './purchase.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, PurchaseOrderStatus } from '@prisma/client';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('purchase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Create a received purchase order (adds stock immediately) - Admin only',
  })
  createPurchaseOrder(
    @Body() createDto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseService.createPurchaseOrder({
      ...createDto,
      userId: user.id,
    });
  }

  @Post('pending')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Create a pending purchase order (does not add stock) - Admin only',
  })
  createPendingPurchaseOrder(
    @Body() createDto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseService.createPendingPurchaseOrder({
      ...createDto,
      userId: user.id,
    });
  }

  @Patch(':id/receive')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Receive a pending purchase order (Admin only)' })
  receivePurchaseOrder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseService.receivePurchaseOrder(id, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all purchase orders' })
  @ApiQuery({ name: 'supplierId', required: false, type: String })
  @ApiQuery({ name: 'status', enum: PurchaseOrderStatus, required: false })
  getPurchaseOrders(
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: PurchaseOrderStatus,
  ) {
    return this.purchaseService.getPurchaseOrders({
      supplierId: supplierId ? supplierId : undefined,
      status,
    });
  }

  @Get('supplier-summary/:supplierId')
  @ApiOperation({ summary: 'Get purchase summary for a supplier' })
  getSupplierSummary(@Param('supplierId') supplierId: string) {
    return this.purchaseService.getSupplierPurchaseSummary(supplierId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase order by id' })
  getPurchaseOrderById(@Param('id') id: string) {
    return this.purchaseService.getPurchaseOrderById(id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cancel a pending purchase order (Admin only)' })
  cancelPurchaseOrder(@Param('id') id: string) {
    return this.purchaseService.cancelPurchaseOrder(id);
  }
}
