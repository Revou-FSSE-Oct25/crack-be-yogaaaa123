import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createTenantSoftDeleteExtension } from './prisma.extension';

/**
 * PrismaService — Database access layer with tenant isolation support.
 *
 * This service extends PrismaClient directly for full backward compatibility.
 * All existing `this.prisma.product`, `this.prisma.$transaction`, etc. calls
 * continue to work without modification.
 *
 * For tenant-aware queries, use `getClient(tenantId)` which returns an extended
 * Prisma client that automatically filters by tenantId and soft-delete status.
 *
 * USAGE:
 *   // Existing code (no tenant filter — works as before):
 *   this.prisma.product.findMany({ where: { deletedAt: null } })
 *
 *   // Tenant-aware code (auto-filters by tenantId + deletedAt):
 *   const prisma = this.prisma.getClient(tenantId);
 *   prisma.product.findMany() // automatically adds tenantId + deletedAt: null
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  /**
   * Get a tenant-aware Prisma client that automatically:
   * - Filters by `tenantId` for tenant-scoped models
   * - Filters out soft-deleted records (`deletedAt: null`)
   *
   * @param tenantId - The tenant ID to scope queries to
   * @returns Extended Prisma client with automatic filters
   */
  getClient(tenantId?: string) {
    return this.$extends(createTenantSoftDeleteExtension(tenantId));
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
