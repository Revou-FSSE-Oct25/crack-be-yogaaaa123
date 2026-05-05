import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('activity-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(TenantRole.ADMIN)
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @ApiOperation({
    summary: 'Semua activity logs (Admin only — dengan pagination)',
    description: `
Mendapatkan riwayat aktivitas semua user di sistem.

**Data yang dicatat:**
- Setiap perubahan data (create, update, delete)
- User yang melakukan aksi
- Timestamp
- Detail perubahan

**Akses:** ADMIN ONLY
    `,
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Daftar activity logs',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            action: 'CREATE',
            entity: 'Product',
            entityId: 'uuid-prod',
            userId: 'uuid-user',
            user: { username: 'admin1' },
            createdAt: '2026-05-01T10:00:00Z',
          },
        ],
        total: 100,
      },
    },
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.activityLogService.findAll(
      user.tenantId,
      skip !== undefined ? parseInt(skip, 10) : undefined,
      take !== undefined ? parseInt(take, 10) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail activity log by ID' })
  @ApiResponse({ status: 200, description: 'Detail activity log' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.activityLogService.findOne(id, user.tenantId);
  }
}
