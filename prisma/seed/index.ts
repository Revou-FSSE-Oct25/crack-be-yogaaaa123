import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { cleanup } from './cleanup';
import { seedTenantAndUsers } from './tenant-and-users';
import { seedCategories } from './categories';
import { seedSuppliers } from './suppliers';
import { seedProducts } from './products';
import { seedPurchaseOrders } from './purchase-orders';
import { seedSalesOrders } from './sales-orders';
import { printSummary } from './summary';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Database Seeding...');

  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
  const staffPassword = process.env.DEFAULT_STAFF_PASSWORD || 'Staff@123';
  const superAdminPassword = process.env.DEFAULT_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

  // 1. Cleanup
  await cleanup(prisma);

  // 2. Tenant & Users
  const { tenant, adminUser, staffUser } = await seedTenantAndUsers(
    prisma,
    adminPassword,
    staffPassword,
    superAdminPassword,
  );

  // 3. Categories
  const { electronics, stationery, furniture } = await seedCategories(prisma, tenant.id);

  // 4. Suppliers
  const { supplierA, supplierB } = await seedSuppliers(prisma, tenant.id);

  // 5. Products
  let products = await seedProducts(
    prisma,
    tenant.id,
    electronics.id,
    stationery.id,
    furniture.id,
    supplierA.id,
    supplierB.id,
  );

  // 6. Purchase Orders (updates stock, reloads products)
  products = await seedPurchaseOrders(
    prisma,
    tenant.id,
    products,
    adminUser.id,
    supplierA.id,
    supplierB.id,
  );

  // 7. Sales Orders
  await seedSalesOrders(prisma, tenant.id, products, staffUser.id);

  // 8. Summary
  await printSummary(prisma);
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
