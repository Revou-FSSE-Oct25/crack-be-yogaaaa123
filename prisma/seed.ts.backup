import { PrismaClient, TenantRole, type Product } from '@prisma/client';
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
  const superAdminPassword = process.env.DEFAULT_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  // === 1. CLEANUP EXISTING DATA (respecting foreign key constraints) ===
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

  // === 2. CREATE TENANT ===
  console.log('🏪 Creating Tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Default Store',
      slug: 'default-store',
      aiTokens: 150,
      aiTokensUsed: 0,
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (${tenant.slug})`);

  // === 3. CREATE PLATFORM USER (owner) ===
  console.log('👤 Creating Platform User...');
  const platformUser = await prisma.platformUser.create({
    data: {
      email: 'owner@inventory.com',
      name: 'Store Owner',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`✅ Platform User created: ${platformUser.email}`);

  // === 4. CREATE TENANT MEMBER ===
  console.log('🔗 Creating Tenant Member...');
  await prisma.tenantMember.create({
    data: {
      role: 'OWNER',
      platformUserId: platformUser.id,
      tenantId: tenant.id,
    },
  });
  console.log('✅ Tenant Member created.');

  // === 5. CREATE TENANT USERS ===
  console.log('👤 Creating Tenant Users...');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

  const adminUser = await prisma.tenantUser.create({
    data: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: TenantRole.ADMIN,
      displayName: 'Admin',
      tenantId: tenant.id,
    },
  });

  const staffUser = await prisma.tenantUser.create({
    data: {
      username: 'staff',
      passwordHash: staffPasswordHash,
      role: TenantRole.STAFF,
      displayName: 'Staff',
      tenantId: tenant.id,
    },
  });
  console.log(`✅ Tenant Users created: ${adminUser.username} & ${staffUser.username}.`);

  // === 6. CREATE CATEGORIES ===
  console.log('📦 Creating Categories...');
  const electronics = await prisma.category.create({
    data: {
      name: 'Electronics',
      description: 'Electronic devices and accessories',
      tenantId: tenant.id,
    },
  });
  const stationery = await prisma.category.create({
    data: {
      name: 'Stationery',
      description: 'Office and school supplies',
      tenantId: tenant.id,
    },
  });
  const furniture = await prisma.category.create({
    data: {
      name: 'Furniture',
      description: 'Office and home furniture',
      tenantId: tenant.id,
    },
  });
  console.log('✅ Categories created.');

  // === 7. CREATE SUPPLIERS ===
  console.log('🏢 Creating Suppliers...');
  const supplierA = await prisma.supplier.create({
    data: {
      name: 'TechNova Solutions',
      contactName: 'John Doe',
      phone: '+1-555-0101',
      email: 'contact@technova.com',
      address: '123 Tech Park, Silicon Valley',
      tenantId: tenant.id,
    },
  });
  const supplierB = await prisma.supplier.create({
    data: {
      name: 'Office Depot Max',
      contactName: 'Jane Smith',
      phone: '+1-555-0202',
      email: 'sales@officedepotmax.com',
      address: '456 Commerce St, Business District',
      tenantId: tenant.id,
    },
  });
  console.log('✅ Suppliers created.');

  // === 8. CREATE PRODUCTS ===
  console.log('🛒 Creating Products...');

  const purchasePrices = [20.0, 70.0, 200.0, 3.5, 6.0, 120.0];

  const productsData = [
    {
      sku: 'SKU-ELEC-001',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with 2.4GHz receiver',
      price: 25.5,
      stockQuantity: 0,
      reorderLevel: 10,
      averageCost: 0,
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
    const product = await prisma.product.create({
      data: {
        ...pData,
        tenantId: tenant.id,
      },
    });
    products.push(product);
  }
  console.log(`✅ ${products.length} Products created.`);

  // === 9. PURCHASE ORDERS ===
  console.log('📦 Processing Purchase Orders...');

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
      supplierId: supplierA.id,
      userId: adminUser.id,
      tenantId: tenant.id,
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
        userId: adminUser.id,
        tenantId: tenant.id,
      },
    });
  }
  console.log(`✅ Purchase Order ${po1.orderNumber} created & stock updated.`);

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
      supplierId: supplierB.id,
      userId: adminUser.id,
      tenantId: tenant.id,
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
        tenantId: tenant.id,
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

  // === 10. SALES ORDERS ===
  console.log('🛍️ Creating Sales Orders...');

  // Sales Order 1: 2x Mouse + 1x Keyboard
  const so1Items = [
    { product: updatedProducts[0], quantity: 2, unitPrice: 25.5 },
    { product: updatedProducts[1], quantity: 1, unitPrice: 85 },
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
      userId: staffUser.id,
      tenantId: tenant.id,
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
        userId: staffUser.id,
        tenantId: tenant.id,
      },
    });
  }
  console.log(`✅ Sales Order ${so1.orderNumber} created.`);

  // Sales Order 2: 5x Notebook + 1x Chair
  const so2Items = [
    { product: updatedProducts[3], quantity: 5, unitPrice: 5 },
    { product: updatedProducts[5], quantity: 1, unitPrice: 150 },
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
      userId: staffUser.id,
      tenantId: tenant.id,
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
        userId: staffUser.id,
        tenantId: tenant.id,
      },
    });
  }
  console.log(`✅ Sales Order ${so2.orderNumber} created.`);

  // Sales Order 3 (Pending — no stock deduction)
  const so3Items = [{ product: updatedProducts[2], quantity: 1, unitPrice: 250 }];
  const so3TotalPrice = 250;
  const so3TotalCogs = 1 * Number(updatedProducts[2].averageCost);
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
      tenantId: tenant.id,
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

  // === 11. CREATE PLATFORM ADMIN (Super Admin) ===
  console.log('🛡️ Creating Platform Admin (Super Admin)...');
  await prisma.platformAdmin.create({
    data: {
      email: 'superadmin@crack.com',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash(superAdminPassword, 10),
    },
  });
  console.log('✅ Platform Admin created: superadmin@crack.com');

  // === 12. DATABASE SUMMARY ===
  console.log('\n🎉 Database Seeding Completed Successfully!');
  console.log('===========================================');

  const tenantCount = await prisma.tenant.count();
  const userCount = await prisma.tenantUser.count();
  const categoryCount = await prisma.category.count();
  const supplierCount = await prisma.supplier.count();
  const productCount = await prisma.product.count();
  const purchaseOrderCount = await prisma.purchaseOrder.count();
  const salesOrderCount = await prisma.salesOrder.count();
  const stockTransactionCount = await prisma.stockTransaction.count();

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
