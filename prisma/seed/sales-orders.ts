import { PrismaClient, type Product } from '@prisma/client';

export async function seedSalesOrders(
  prisma: PrismaClient,
  tenantId: string,
  products: Product[],
  staffUserId: string,
) {
  console.log('🛍️ Creating Sales Orders...');

  // --- SO-1001: 2x Mouse + 1x Keyboard ---
  const so1Items = [
    { product: products[0], quantity: 2, unitPrice: 25.5 },
    { product: products[1], quantity: 1, unitPrice: 85 },
  ];

  const so1TotalPrice = so1Items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const so1TotalCogs = so1Items.reduce(
    (sum, i) => sum + i.quantity * Number(i.product.averageCost),
    0,
  );
  const so1TotalProfit = so1TotalPrice - so1TotalCogs;

  const so1 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-1001',
      customerId: 'CUST-001',
      status: 'COMPLETED',
      totalPrice: so1TotalPrice,
      totalCogs: so1TotalCogs,
      totalProfit: so1TotalProfit,
      userId: staffUserId,
      tenantId,
      items: {
        create: so1Items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          cogs: Number(i.product.averageCost) * i.quantity,
          profitMargin: (i.unitPrice - Number(i.product.averageCost)) * i.quantity,
        })),
      },
    },
  });

  for (const item of so1Items) {
    await prisma.product.update({
      where: { id: item.product.id },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    await prisma.stockTransaction.create({
      data: {
        type: 'OUT',
        quantity: item.quantity,
        referenceId: so1.orderNumber,
        notes: 'Sales Order Completed',
        productId: item.product.id,
        userId: staffUserId,
        tenantId,
      },
    });
  }
  console.log(`✅ Sales Order ${so1.orderNumber} created.`);

  // --- SO-1002: 5x Notebook + 1x Chair ---
  const so2Items = [
    { product: products[3], quantity: 5, unitPrice: 5 },
    { product: products[5], quantity: 1, unitPrice: 150 },
  ];

  const so2TotalPrice = so2Items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const so2TotalCogs = so2Items.reduce(
    (sum, i) => sum + i.quantity * Number(i.product.averageCost),
    0,
  );
  const so2TotalProfit = so2TotalPrice - so2TotalCogs;

  const so2 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-1002',
      customerId: 'CUST-002',
      status: 'COMPLETED',
      totalPrice: so2TotalPrice,
      totalCogs: so2TotalCogs,
      totalProfit: so2TotalProfit,
      userId: staffUserId,
      tenantId,
      items: {
        create: so2Items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          cogs: Number(i.product.averageCost) * i.quantity,
          profitMargin: (i.unitPrice - Number(i.product.averageCost)) * i.quantity,
        })),
      },
    },
  });

  for (const item of so2Items) {
    await prisma.product.update({
      where: { id: item.product.id },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    await prisma.stockTransaction.create({
      data: {
        type: 'OUT',
        quantity: item.quantity,
        referenceId: so2.orderNumber,
        notes: 'Sales Order Completed',
        productId: item.product.id,
        userId: staffUserId,
        tenantId,
      },
    });
  }
  console.log(`✅ Sales Order ${so2.orderNumber} created.`);

  // --- SO-1003 (PENDING - no stock deduction) ---
  const so3Items = [{ product: products[2], quantity: 1, unitPrice: 250 }];
  const so3TotalPrice = 250;
  const so3TotalCogs = 1 * Number(products[2].averageCost);
  const so3TotalProfit = so3TotalPrice - so3TotalCogs;

  const so3 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-1003',
      customerId: 'CUST-003',
      status: 'PENDING',
      totalPrice: so3TotalPrice,
      totalCogs: so3TotalCogs,
      totalProfit: so3TotalProfit,
      userId: staffUserId,
      tenantId,
      items: {
        create: so3Items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          cogs: Number(i.product.averageCost) * i.quantity,
          profitMargin: (i.unitPrice - Number(i.product.averageCost)) * i.quantity,
        })),
      },
    },
  });
  console.log(`✅ Sales Order ${so3.orderNumber} (PENDING) created.`);
}