import type { PrismaClient } from '@prisma/client';

export async function seedCategories(prisma: PrismaClient, tenantId: string) {
  console.log('📦 Creating Categories...');
  const electronics = await prisma.category.create({
    data: {
      name: 'Electronics',
      description: 'Electronic devices and accessories',
      tenantId,
    },
  });
  const stationery = await prisma.category.create({
    data: {
      name: 'Stationery',
      description: 'Office and school supplies',
      tenantId,
    },
  });
  const furniture = await prisma.category.create({
    data: {
      name: 'Furniture',
      description: 'Office and home furniture',
      tenantId,
    },
  });
  console.log('✅ Categories created.');
  return { electronics, stationery, furniture };
}