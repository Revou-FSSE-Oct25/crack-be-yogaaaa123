import { PrismaClient, type Product } from '@prisma/client';

export async function seedPurchaseOrders(
  prisma: PrismaClient,
  tenantId: string,
  products: Product[],
  adminUserId: string,
  supplierAId: string,
  supplierBId: string,
): Promise<Product[]> {
  console.log('📦 Processing Purchase Orders...');

  const purchasePrices = [20.0, 70.0, 200.0, 3.5, 6.0, 120.0];

  // --- PO-1001 (TechNova) ---
  const po1Items = [
    { productId: products[0].id, quantity: 50, unitPrice: purchasePrices[0] },
    { productId: products[1].id, quantity: 30, unitPrice: purchasePrices[1] },
    { productId: products[2].id, quantity: 20, unitPrice: purchasePrices[2] },
  ];

  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-1001',
      totalPrice: po1Items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
      status: 'RECEIVED',
      notes: 'Initial stock purchase from TechNova',
      supplierId: supplierAId,
      userId: adminUserId,
      tenantId,
      receivedAt: new Date(),
      items: {
        create: po1Items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
    },
  });

  for (const item of po1Items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: {
        stockQuantity: { increment: item.quantity },
        averageCost: item.unitPrice,
      },
    });
    await prisma.stockTransaction.create({
      data: {
        type: 'IN',
        quantity: item.quantity,
        referenceId: po1.orderNumber,
        notes: 'Purchase Order Received',
        productId: item.productId,
        userId: adminUserId,
        tenantId,
      },
    });
  }
  console.log(`✅ Purchase Order ${po1.orderNumber} created & stock updated.`);

  // --- PO-1002 (Office Depot) ---
  const po2Items = [
    { productId: products[3].id, quantity: 100, unitPrice: purchasePrices[3] },
    { productId: products[4].id, quantity: 80, unitPrice: purchasePrices[4] },
    { productId: products[5].id, quantity: 15, unitPrice: purchasePrices[5] },
  ];

  const po2 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-1002',
      totalPrice: po2Items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
      status: 'RECEIVED',
      notes: 'Office supplies purchase from Office Depot',
      supplierId: supplierBId,
      userId: adminUserId,
      tenantId,
      receivedAt: new Date(),
      items: {
        create: po2Items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
    },
  });

  for (const item of po2Items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: {
        stockQuantity: { increment: item.quantity },
        averageCost: item.unitPrice,
      },
    });
    await prisma.stockTransaction.create({
      data: {
        type: 'IN',
        quantity: item.quantity,
        referenceId: po2.orderNumber,
        notes: 'Purchase Order Received',
        productId: item.productId,
        userId: adminUserId,
        tenantId,
      },
    });
  }
  console.log(`✅ Purchase Order ${po2.orderNumber} created & stock updated.`);

  // Reload products to get updated stock/averageCost
  const updatedProducts: Product[] = [];
  for (const p of products) {
    const up = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    updatedProducts.push(up);
  }
  return updatedProducts;
}
