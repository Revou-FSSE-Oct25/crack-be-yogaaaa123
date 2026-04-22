import { Module } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { PrismaService } from '../prisma.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [PurchaseController],
  providers: [PurchaseService, PrismaService],
})
export class PurchaseModule {}
