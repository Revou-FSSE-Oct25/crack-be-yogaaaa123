import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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

@Module({
  imports: [
    // Rate Limiting — 60 requests per 60 detik (global default)
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000, // 60 detik
        limit: 60, // maks 60 request per window
      },
      {
        name: 'auth',
        ttl: 60000, // 60 detik
        limit: 10, // maks 10 request per window (untuk endpoint auth)
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aktifkan ThrottlerGuard secara global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
