import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
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
  providers: [AppService, PrismaService],
})
export class AppModule {}
