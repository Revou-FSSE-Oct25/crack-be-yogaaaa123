import type { PrismaClient } from '@prisma/client';

export async function printSummary(prisma: PrismaClient) {
  console.log('\n🎉 Database Seeding Completed Successfully!');
  console.log('===========================================');

  const [
    tenantCount,
    userCount,
    categoryCount,
    supplierCount,
    productCount,
    purchaseOrderCount,
    salesOrderCount,
    stockTransactionCount,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenantUser.count(),
    prisma.category.count(),
    prisma.supplier.count(),
    prisma.product.count(),
    prisma.purchaseOrder.count(),
    prisma.salesOrder.count(),
    prisma.stockTransaction.count(),
  ]);

  console.log('📊 Database Summary:');
  console.log(`   🏪 Tenants: ${tenantCount}`);
  console.log(`   👥 Users: ${userCount} (admin, staff)`);
  console.log(`   📦 Categories: ${categoryCount}`);
  console.log(`   🏢 Suppliers: ${supplierCount}`);
  console.log(`   🛒 Products: ${productCount}`);
  console.log(`   📦 Purchase Orders: ${purchaseOrderCount}`);
  console.log(`   🛍️  Sales Orders: ${salesOrderCount} (2 COMPLETED, 1 PENDING)`);
  console.log(`   📊 Stock Transactions: ${stockTransactionCount}`);

  console.log('\n📦 Product Stock & Cost Summary:');
  const finalProducts = await prisma.product.findMany({
    orderBy: { sku: 'asc' },
    select: { sku: true, name: true, price: true, averageCost: true, stockQuantity: true },
  });
  finalProducts.forEach((p) => {
    console.log(
      `   - ${p.sku}: ${p.name} | Stock: ${p.stockQuantity} | Price: $${Number(p.price)} | AvgCost: $${Number(p.averageCost)}`,
    );
  });

  console.log('\n👥 Customer Transactions:');
  const recentSales = await prisma.salesOrder.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      customerId: true,
      status: true,
      totalPrice: true,
      totalCogs: true,
      totalProfit: true,
    },
  });

  recentSales.forEach((order) => {
    console.log(
      `   - ${order.orderNumber}: Customer ${order.customerId}, Status: ${order.status}, Price: $${Number(order.totalPrice)}, COGS: $${Number(order.totalCogs)}, Profit: $${Number(order.totalProfit)}`,
    );
  });

  console.log('\n✅ Seed ready for production use!');
}
