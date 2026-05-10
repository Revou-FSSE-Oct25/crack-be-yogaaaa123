import { Module } from '@nestjs/common';
import { AiDataController } from './ai-data.controller';
import { PrismaModule } from '../prisma.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, DashboardModule, ProductsModule, UsersModule],
  controllers: [AiDataController],
})
export class AiDataModule {}
