import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from './prisma/prisma.module';
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
import { PrismaService } from './prisma/prisma.service';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { TenantThrottlerGuard } from './common/guards/tenant-throttler.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { SanitizeMiddleware } from './common/middleware/sanitize.middleware';
import { createWinstonLoggerOptions } from './config/logger.config';

@Module({
  imports: [
    WinstonModule.forRoot(createWinstonLoggerOptions()),

    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 300,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
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

    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    {
      provide: APP_GUARD,
      useClass: TenantThrottlerGuard,
    },

    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },

    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SanitizeMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
