import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
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

@ApiTags('returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @Roles(TenantRole.ADMIN, TenantRole.STAFF)
  @ApiOperation({
    summary: 'Buat return barang (Admin & Staff)',
    description: `
Mencatat retur barang dari customer.

**Proses:**
1. Validasi sales order ada & statusnya COMPLETED
2. Kembalikan stok setiap item yang diretur
3. Catat transaksi inventory (IN)
4. Update profit/loss

**Aturan:**
- Quantity retur tidak boleh melebihi quantity yang dibeli
- Setiap item retur di-ref ke orderItemId spesifik

**Akses:** ADMIN dan STAFF
    `,
  })
  @ApiBody({ type: CreateReturnDto })
  @ApiResponse({
    status: 201,
    description: 'Return berhasil dibuat',
    schema: {
      example: {
        id: 'uuid-ret-1',
        returnNumber: 'RET-1001',
        status: 'COMPLETED',
        items: [{ orderItemId: 'uuid-order-item', quantity: 1 }],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — quantity melebihi pembelian' })
  create(@Body() createReturnDto: CreateReturnDto, @CurrentUser() user: AuthenticatedUser) {
    return this.returnsService.createReturn(createReturnDto, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar semua returns (dengan pagination)',
    description: 'Mendapatkan daftar semua transaksi retur.',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.returnsService.findAll(
      user.tenantId,
      skip !== undefined ? parseInt(skip, 10) : undefined,
      take !== undefined ? parseInt(take, 10) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail return by ID',
    description: 'Mendapatkan detail lengkap return termasuk item yang diretur.',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.returnsService.findOne(user.tenantId, id);
  }
}
