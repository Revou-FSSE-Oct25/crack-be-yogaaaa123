import type { PrismaClient } from '@prisma/client';

export async function cleanup(prisma: PrismaClient) {
  console.log('🧹 Cleaning up existing data...');
  await prisma.$transaction([
    prisma.salesReturnItem.deleteMany(),
    prisma.salesReturn.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.stockTransaction.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.tenantMember.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.tenantUser.deleteMany(),
    prisma.tenant.deleteMany(),
    prisma.platformUser.deleteMany(),
    prisma.platformAdmin.deleteMany(),
  ]);
  console.log('✅ Data cleanup completed.');
}