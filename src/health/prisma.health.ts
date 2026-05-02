import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Execute a lightweight query to verify database connectivity
      await this.prisma.tenantUser.findFirst({ select: { id: true } });
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, { message: (e as Error).message }),
      );
    }
  }
}
