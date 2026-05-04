import type { PrismaClient } from '@prisma/client';

export async function seedSuppliers(prisma: PrismaClient, tenantId: string) {
  console.log('🏢 Creating Suppliers...');
  const supplierA = await prisma.supplier.create({
    data: {
      name: 'TechNova Solutions',
      contactName: 'John Doe',
      phone: '+1-555-0101',
      email: 'contact@technova.com',
      address: '123 Tech Park, Silicon Valley',
      tenantId,
    },
  });
  const supplierB = await prisma.supplier.create({
    data: {
      name: 'Office Depot Max',
      contactName: 'Jane Smith',
      phone: '+1-555-0202',
      email: 'sales@officedepotmax.com',
      address: '456 Commerce St, Business District',
      tenantId,
    },
  });
  console.log('✅ Suppliers created.');
  return { supplierA, supplierB };
}