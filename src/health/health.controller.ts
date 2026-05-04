import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { Public } from '../common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
  ) {}

  @Public()
  @Throttle({ global: { ttl: 60000, limit: 20 } })
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check — verifies app and database connectivity',
  })
  @ApiResponse({ status: 200, description: 'Service is healthy and database is connected' })
  @ApiResponse({ status: 503, description: 'Service is down or database is disconnected' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.isHealthy('database')]);
  }
}
