import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createTenantSoftDeleteExtension } from './prisma.extension';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  private clientCache = new Map<string, PrismaClient>();

  getClient(tenantId?: string): PrismaClient {
    const key = tenantId || 'GLOBAL';
    if (!this.clientCache.has(key)) {
      this.clientCache.set(
        key,
        this.$extends(createTenantSoftDeleteExtension(tenantId)) as unknown as PrismaClient,
      );
    }
    return this.clientCache.get(key)!;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected gracefully');
  }
}
