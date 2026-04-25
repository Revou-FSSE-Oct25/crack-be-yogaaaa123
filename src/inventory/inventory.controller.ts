import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjust')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually adjust stock (Admin only)' })
  adjustStock(
    @Body() adjustStockDto: AdjustStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjustStock(
      adjustStockDto.productId,
      user.id,
      adjustStockDto.quantityChange,
      adjustStockDto.type,
      adjustStockDto.referenceId,
      adjustStockDto.notes,
    );
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get products below reorder level' })
  getLowStockProducts() {
    return this.inventoryService.getLowStockProducts();
  }

  @Get('check-reorder/:productId')
  @ApiOperation({ summary: 'Check if a specific product needs reorder' })
  checkReorderLevel(@Param('productId') productId: string) {
    return this.inventoryService.checkReorderLevel(productId);
  }
}
