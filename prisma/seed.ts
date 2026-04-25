import { PrismaClient, Role, Product } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Prisma Client
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Database Seeding...');

  // Load environment variables
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
  const staffPassword = process.env.DEFAULT_STAFF_PASSWORD || 'Staff@123';

  // === 1. CLEANUP EXISTING DATA (respecting foreign key constraints) ===
  console.log('🧹 Cleaning up existing data...');
  await prisma.$transaction([
    prisma.salesReturnItem.deleteMany(),
    prisma.salesReturn.deleteMany(),
    // Order items before parent orders
    prisma.orderItem.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    // Orders
    prisma.salesOrder.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    // Stock transactions
    prisma.stockTransaction.deleteMany(),
    // Master data
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log('✅ Data cleanup completed.');

  // === 2. CREATE USERS ===
  console.log('👤 Creating Users...');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@inventory.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      username: 'staff',
      email: 'staff@inventory.com',
      passwordHash: staffPasswordHash,
      role: Role.STAFF,
    },
  });
  console.log(
    `✅ Users created: ${adminUser.username} & ${staffUser.username}.`,
  );

  // === 3. CREATE CATEGORIES ===
  console.log('📦 Creating Categories...');
  const electronics = await prisma.category.create({
    data: {
      name: 'Electronics',
      description: 'Electronic devices and accessories',
    },
  });
  const stationery = await prisma.category.create({
    data: {
      name: 'Stationery',
      description: 'Office and school supplies',
    },
  });
  const furniture = await prisma.category.create({
    data: {
      name: 'Furniture',
      description: 'Office and home furniture',
    },
  });
  console.log('✅ Categories created.');

  // === 4. CREATE SUPPLIERS ===
  console.log('🏢 Creating Suppliers...');
  const supplierA = await prisma.supplier.create({
    data: {
      name: 'TechNova Solutions',
      contactName: 'John Doe',
      phone: '+1-555-0101',
      email: 'contact@technova.com',
      address: '123 Tech Park, Silicon Valley',
    },
  });
  const supplierB = await prisma.supplier.create({
    data: {
      name: 'Office Depot Max',
      contactName: 'Jane Smith',
      phone: '+1-555-0202',
      email: 'sales@officedepotmax.com',
      address: '456 Commerce St, Business District',
    },
  });
  console.log('✅ Suppliers created.');

  // === 5. CREATE PRODUCTS (without initial stock — stock comes from PO) ===
  console.log('🛒 Creating Products...');

  // Purchase prices (cost) for each product — used for averageCost calculation
  const purchasePrices = [20.0, 70.0, 200.0, 3.5, 6.0, 120.0];

  const productsData = [
    {
      sku: 'SKU-ELEC-001',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with 2.4GHz receiver',
      price: 25.5,
      stockQuantity: 0, // Will be populated by purchase order
      reorderLevel: 10,
      averageCost: 0, // Will be calculated when PO is received
      categoryId: electronics.id,
      supplierId: supplierA.id,
    },
    {
      sku: 'SKU-ELEC-002',
      name: 'Mechanical Keyboard',
      description: 'RGB mechanical keyboard with Cherry MX switches',
      price: 85,
      stockQuantity: 0,
      reorderLevel: 5,
      averageCost: 0,
      categoryId: electronics.id,
      supplierId: supplierA.id,
    },
    {
      sku: 'SKU-ELEC-003',
      name: '27-inch Monitor',
      description: '4K UHD monitor with IPS panel',
      price: 250,
      stockQuantity: 0,
      reorderLevel: 5,
      averageCost: 0,
      categoryId: electronics.id,
      supplierId: supplierA.id,
    },
    {
      sku: 'SKU-STAT-001',
      name: 'Notebook A5',
      description: 'Premium A5 notebook with 120 pages',
      price: 5,
      stockQuantity: 0,
      reorderLevel: 20,
      averageCost: 0,
      categoryId: stationery.id,
      supplierId: supplierB.id,
    },
    {
      sku: 'SKU-STAT-002',
      name: 'Ballpoint Pens (Pack of 10)',
      description: 'Smooth-writing ballpoint pens in assorted colors',
      price: 8.5,
      stockQuantity: 0,
      reorderLevel: 15,
      averageCost: 0,
      categoryId: stationery.id,
      supplierId: supplierB.id,
    },
    {
      sku: 'SKU-FURN-001',
      name: 'Ergonomic Office Chair',
      description: 'Adjustable office chair with lumbar support',
      price: 150,
      stockQuantity: 0,
      reorderLevel: 3,
      averageCost: 0,
      categoryId: furniture.id,
      supplierId: supplierB.id,
    },
  ];

  const products: Product[] = [];
  for (const pData of productsData) {
    const product = await prisma.product.create({ data: pData });
    products.push(product);
  }
  console.log(`✅ ${products.length} Products created.`);

  // === 6. PURCHASE ORDERS (properly updates stock + averageCost) ===
  console.log('📦 Processing Purchase Orders (with stock & averageCost)...');

  // Purchase Order from Supplier A — items: Mouse(50), Keyboard(30), Monitor(20)
  const po1Items = [
    { productId: products[0].id, quantity: 50, unitPrice: purchasePrices[0] },
    { productId: products[1].id, quantity: 30, unitPrice: purchasePrices[1] },
    { productId: products[2].id, quantity: 20, unitPrice: purchasePrices[2] },
  ];

  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-1001',
      totalPrice: po1Items.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0,
      ),
      status: 'RECEIVED',
      notes: 'Initial stock purchase from TechNova',
      supplierId: supplierA.id,
      userId: adminUser.id,
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

  // Update stock and averageCost for PO-1001 items
  for (const item of po1Items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: {
        stockQuantity: { increment: item.quantity },
        averageCost: item.unitPrice, // First purchase — averageCost = purchase price
      },
    });
    await prisma.stockTransaction.create({
      data: {
        type: 'IN',
        quantity: item.quantity,
        referenceId: po1.orderNumber,
        notes: 'Purchase Order Received',
        productId: item.productId,
        userId: adminUser.id,
      },
    });
  }
  console.log(`✅ Purchase Order ${po1.orderNumber} created & stock updated.`);

  // Purchase Order from Supplier B — items: Notebook(100), Pens(80), Chair(15)
  const po2Items = [
    { productId: products[3].id, quantity: 100, unitPrice: purchasePrices[3] },
    { productId: products[4].id, quantity: 80, unitPrice: purchasePrices[4] },
    { productId: products[5].id, quantity: 15, unitPrice: purchasePrices[5] },
  ];

  const po2 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-1002',
      totalPrice: po2Items.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0,
      ),
      status: 'RECEIVED',
      notes: 'Office supplies purchase from Office Depot',
      supplierId: supplierB.id,
      userId: adminUser.id,
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
        userId: adminUser.id,
      },
    });
  }
  console.log(`✅ Purchase Order ${po2.orderNumber} created & stock updated.`);

  // Reload products to get updated stock and averageCost
  const updatedProducts: Product[] = [];
  for (const p of products) {
    const up = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    updatedProducts.push(up);
  }

  // === 7. SALES ORDERS (with proper COGS and profit calculation) ===
  console.log('🛍️ Creating Sales Orders (with COGS & profit)...');

  // Sales Order 1: 2x Mouse + 1x Keyboard
  const so1Items = [
    { product: updatedProducts[0], quantity: 2, unitPrice: 25.5 },
    { product: updatedProducts[1], quantity: 1, unitPrice: 85 },
  ];

  const so1TotalPrice = so1Items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );
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
      userId: staffUser.id,
      items: {
        create: so1Items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          cogs: Number(i.product.averageCost) * i.quantity,
          profitMargin:
            (i.unitPrice - Number(i.product.averageCost)) * i.quantity,
        })),
      },
    },
  });

  // Decrement stock for SO-1001
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
        userId: staffUser.id,
      },
    });
  }
  console.log(
    `✅ Sales Order ${so1.orderNumber} created (COGS: $${so1TotalCogs.toFixed(2)}, Profit: $${so1TotalProfit.toFixed(2)}).`,
  );

  // Sales Order 2: 5x Notebook + 1x Chair
  const so2Items = [
    { product: updatedProducts[3], quantity: 5, unitPrice: 5 },
    { product: updatedProducts[5], quantity: 1, unitPrice: 150 },
  ];

  const so2TotalPrice = so2Items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );
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
      userId: staffUser.id,
      items: {
        create: so2Items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          cogs: Number(i.product.averageCost) * i.quantity,
          profitMargin:
            (i.unitPrice - Number(i.product.averageCost)) * i.quantity,
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
        userId: staffUser.id,
      },
    });
  }
  console.log(
    `✅ Sales Order ${so2.orderNumber} created (COGS: $${so2TotalCogs.toFixed(2)}, Profit: $${so2TotalProfit.toFixed(2)}).`,
  );

  // Sales Order 3 (Pending — no stock deduction)
  const so3Items = [{ product: updatedProducts[2], quantity: 1, unitPrice: 250 }];
  const so3TotalPrice = 250;
  const so3TotalCogs =
    1 * Number(updatedProducts[2].averageCost);
  const so3TotalProfit = so3TotalPrice - so3TotalCogs;

  const so3 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-1003',
      customerId: 'CUST-003',
      status: 'PENDING',
      totalPrice: so3TotalPrice,
      totalCogs: so3TotalCogs,
      totalProfit: so3TotalProfit,
      userId: staffUser.id,
      items: {
        create: so3Items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          cogs: Number(i.product.averageCost) * i.quantity,
          profitMargin:
            (i.unitPrice - Number(i.product.averageCost)) * i.quantity,
        })),
      },
    },
  });
  console.log(`✅ Sales Order ${so3.orderNumber} (PENDING) created.`);

  // === 8. DATABASE SUMMARY ===
  console.log('\n🎉 Database Seeding Completed Successfully!');
  console.log('===========================================');

  const userCount = await prisma.user.count();
  const categoryCount = await prisma.category.count();
  const supplierCount = await prisma.supplier.count();
  const productCount = await prisma.product.count();
  const purchaseOrderCount = await prisma.purchaseOrder.count();
  const salesOrderCount = await prisma.salesOrder.count();
  const stockTransactionCount = await prisma.stockTransaction.count();

  console.log('📊 Database Summary:');
  console.log(`   👥 Users: ${userCount} (admin, staff)`);
  console.log(`   📦 Categories: ${categoryCount}`);
  console.log(`   🏢 Suppliers: ${supplierCount}`);
  console.log(`   🛒 Products: ${productCount}`);
  console.log(`   📦 Purchase Orders: ${purchaseOrderCount}`);
  console.log(
    `   🛍️  Sales Orders: ${salesOrderCount} (2 COMPLETED, 1 PENDING)`,
  );
  console.log(`   📊 Stock Transactions: ${stockTransactionCount}`);

  // Show product stock & averageCost
  console.log('\n📦 Product Stock & Cost Summary:');
  const finalProducts = await prisma.product.findMany({
    orderBy: { sku: 'asc' },
    select: {
      sku: true,
      name: true,
      price: true,
      averageCost: true,
      stockQuantity: true,
    },
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

// Run the seeding
main()
  .catch((error) => {
    console.error('❌ Seeding failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
