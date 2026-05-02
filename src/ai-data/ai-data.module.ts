import { Module } from '@nestjs/common';
import { AiDataController } from './ai-data.controller';
import { PrismaModule } from '../prisma.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';

/**
 * AiDataModule — Exposes NestJS service methods as read-only HTTP endpoints
 * for the Python AI service to consume (instead of direct DB access).
 *
 * SECURITY:
 * - All endpoints are GET-only (read-only)
 * - Protected by internal API key (X-Internal-API-Key)
 * - User context (user_id, role) is passed as query params from Python
 * - Python AI never modifies data through this module
 */
@Module({
  imports: [PrismaModule, DashboardModule, ProductsModule, UsersModule],
  controllers: [AiDataController],
})
export class AiDataModule {}
