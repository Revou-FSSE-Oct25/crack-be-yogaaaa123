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

  // === 1. CLEANUP EXISTING DATA ===
  console.log('🧹 Cleaning up existing data...');
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.stockTransaction.deleteMany(),
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

  // === 5. CREATE PRODUCTS ===
  console.log('🛒 Creating Products...');
  const productsData = [
    {
      sku: 'SKU-ELEC-001',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with 2.4GHz receiver',
      price: 25.5,
      stockQuantity: 50,
      reorderLevel: 10,
      categoryId: electronics.id,
      supplierId: supplierA.id,
    },
    {
      sku: 'SKU-ELEC-002',
      name: 'Mechanical Keyboard',
      description: 'RGB mechanical keyboard with Cherry MX switches',
      price: 85,
      stockQuantity: 30,
      reorderLevel: 5,
      categoryId: electronics.id,
      supplierId: supplierA.id,
    },
    {
      sku: 'SKU-ELEC-003',
      name: '27-inch Monitor',
      description: '4K UHD monitor with IPS panel',
      price: 250,
      stockQuantity: 20,
      reorderLevel: 5,
      categoryId: electronics.id,
      supplierId: supplierA.id,
    },
    {
      sku: 'SKU-STAT-001',
      name: 'Notebook A5',
      description: 'Premium A5 notebook with 120 pages',
      price: 5,
      stockQuantity: 100,
      reorderLevel: 20,
      categoryId: stationery.id,
      supplierId: supplierB.id,
    },
    {
      sku: 'SKU-STAT-002',
      name: 'Ballpoint Pens (Pack of 10)',
      description: 'Smooth-writing ballpoint pens in assorted colors',
      price: 8.5,
      stockQuantity: 80,
      reorderLevel: 15,
      categoryId: stationery.id,
      supplierId: supplierB.id,
    },
    {
      sku: 'SKU-FURN-001',
      name: 'Ergonomic Office Chair',
      description: 'Adjustable office chair with lumbar support',
      price: 150,
      stockQuantity: 15,
      reorderLevel: 3,
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

  // === 6. CREATE INITIAL STOCK TRANSACTIONS ===
  console.log('📊 Creating Initial Stock Transactions...');
  for (const product of products) {
    await prisma.stockTransaction.create({
      data: {
        type: 'IN',
        quantity: product.stockQuantity,
        referenceId: 'INITIAL-STOCK',
        notes: 'Initial inventory',
        productId: product.id,
        userId: adminUser.id,
      },
    });
  }
  console.log('✅ Stock Transactions created.');

  // === 7. CREATE PURCHASE ORDERS ===
  console.log('📦 Creating Purchase Orders...');

  // Purchase Order from Supplier A
  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-1001',
      totalPrice: 5250,
      status: 'RECEIVED',
      notes: 'Initial stock purchase from TechNova',
      supplierId: supplierA.id,
      userId: adminUser.id,
      receivedAt: new Date(),
      items: {
        create: [
          { productId: products[0].id, quantity: 50, unitPrice: 20.0 },
          { productId: products[1].id, quantity: 30, unitPrice: 70.0 },
          { productId: products[2].id, quantity: 20, unitPrice: 200.0 },
        ],
      },
    },
  });
  console.log(`✅ Purchase Order ${po1.orderNumber} created.`);

  // Purchase Order from Supplier B
  const po2 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-1002',
      totalPrice: 1775,
      status: 'RECEIVED',
      notes: 'Office supplies purchase from Office Depot',
      supplierId: supplierB.id,
      userId: adminUser.id,
      receivedAt: new Date(),
      items: {
        create: [
          { productId: products[3].id, quantity: 100, unitPrice: 3.5 },
          { productId: products[4].id, quantity: 80, unitPrice: 6.0 },
          { productId: products[5].id, quantity: 15, unitPrice: 120.0 },
        ],
      },
    },
  });
  console.log(`✅ Purchase Order ${po2.orderNumber} created.`);

  console.log('✅ Purchase Orders created.');

  // === 8. CREATE SALES ORDERS ===
  console.log('🛍️ Creating Sales Orders...');

  // Sales Order 1
  const so1 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-1001',
      customerId: 'CUST-001',
      status: 'COMPLETED',
      totalPrice: 136, // 2x Mouse + 1x Keyboard
      userId: staffUser.id,
      items: {
        create: [
          { productId: products[0].id, quantity: 2, unitPrice: 25.5 },
          { productId: products[1].id, quantity: 1, unitPrice: 85 },
        ],
      },
    },
  });
  console.log(`✅ Sales Order ${so1.orderNumber} created.`);

  // Sales Order 2
  const so2 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-1002',
      customerId: 'CUST-002',
      status: 'COMPLETED',
      totalPrice: 155, // 5x Notebook + 1x Chair
      userId: staffUser.id,
      items: {
        create: [
          { productId: products[3].id, quantity: 5, unitPrice: 5 },
          { productId: products[5].id, quantity: 1, unitPrice: 150 },
        ],
      },
    },
  });
  console.log(`✅ Sales Order ${so2.orderNumber} created.`);

  // Sales Order 3 (Pending)
  const so3 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO-1003',
      customerId: 'CUST-003',
      status: 'PENDING',
      totalPrice: 250,
      userId: staffUser.id,
      items: {
        create: [{ productId: products[2].id, quantity: 1, unitPrice: 250 }],
      },
    },
  });
  console.log(`✅ Sales Order ${so3.orderNumber} (PENDING) created.`);

  console.log('✅ Sales Orders created.');

  // === 9. UPDATE STOCK AFTER SALES ===
  console.log('📊 Updating stock after sales...');

  // Update stock for SO-1001
  await prisma.product.update({
    where: { id: products[0].id },
    data: { stockQuantity: products[0].stockQuantity - 2 },
  });
  await prisma.product.update({
    where: { id: products[1].id },
    data: { stockQuantity: products[1].stockQuantity - 1 },
  });

  // Update stock for SO-1002
  await prisma.product.update({
    where: { id: products[3].id },
    data: { stockQuantity: products[3].stockQuantity - 5 },
  });
  await prisma.product.update({
    where: { id: products[5].id },
    data: { stockQuantity: products[5].stockQuantity - 1 },
  });

  // Create stock transactions for sales
  await prisma.stockTransaction.createMany({
    data: [
      {
        type: 'OUT',
        quantity: 2,
        referenceId: 'SO-1001',
        notes: 'Sales Order',
        productId: products[0].id,
        userId: staffUser.id,
      },
      {
        type: 'OUT',
        quantity: 1,
        referenceId: 'SO-1001',
        notes: 'Sales Order',
        productId: products[1].id,
        userId: staffUser.id,
      },
      {
        type: 'OUT',
        quantity: 5,
        referenceId: 'SO-1002',
        notes: 'Sales Order',
        productId: products[3].id,
        userId: staffUser.id,
      },
      {
        type: 'OUT',
        quantity: 1,
        referenceId: 'SO-1002',
        notes: 'Sales Order',
        productId: products[5].id,
        userId: staffUser.id,
      },
    ],
  });

  console.log('✅ Stock updated after sales.');

  // === 10. DATABASE SUMMARY ===
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

  console.log('\n👥 Customer Transactions:');
  const recentSales = await prisma.salesOrder.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      customerId: true,
      status: true,
      totalPrice: true,
    },
  });

  recentSales.forEach((order) => {
    console.log(
      `   - ${order.orderNumber}: Customer ${order.customerId}, Status: ${order.status}, Total: $${Number(order.totalPrice)}`,
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
