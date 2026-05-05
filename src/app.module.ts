import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { PurchaseModule } from './purchase/purchase.module';
import { ReturnsModule } from './returns/returns.module';
import { HealthModule } from './health/health.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { UploadModule } from './upload/upload.module';
import { AiModule } from './ai/ai.module';
import { AiDataModule } from './ai-data/ai-data.module';
import { AdminModule } from './admin/admin.module';
import { PrismaService } from './prisma.service';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { TenantThrottlerGuard } from './common/guards/tenant-throttler.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { createWinstonLoggerOptions } from './logger.config';

@Module({
  imports: [
    // Winston — Structured Logging (JSON in prod, colorful in dev)
    WinstonModule.forRoot(createWinstonLoggerOptions()),

    // Rate Limiting — 60 requests per 60 seconds (global default)
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000, // 60 seconds
        limit: 60, // max 60 requests per window
      },
      {
        name: 'auth',
        ttl: 60000, // 60 seconds
        limit: 10, // max 10 requests per window (for auth endpoints)
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    SuppliersModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
    PurchaseModule,
    ReturnsModule,
    HealthModule,
    ActivityLogModule,
    DashboardModule,
    ReportsModule,
    UploadModule,
    AiModule,
    AiDataModule,
    AdminModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    // Global JWT Authentication — all routes require auth unless @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Multi-tenant Rate Limiting — throttles per tenantId instead of per IP
    {
      provide: APP_GUARD,
      useClass: TenantThrottlerGuard,
    },
    // CSRF Double-Submit Cookie Protection — skips @Public() routes
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    // Global Audit Log Interceptor — automatically logs all mutations
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
