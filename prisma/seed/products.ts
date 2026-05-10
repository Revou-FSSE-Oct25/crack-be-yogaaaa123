import { PrismaClient, type Product } from '@prisma/client';

export async function seedProducts(
  prisma: PrismaClient,
  tenantId: string,
  electronicsId: string,
  stationeryId: string,
  furnitureId: string,
  supplierAId: string,
  supplierBId: string,
): Promise<Product[]> {
  console.log('🛒 Creating Products...');

  const productsData = [
    {
      sku: 'SKU-ELEC-001',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with 2.4GHz receiver',
      price: 25.5,
      stockQuantity: 0,
      reorderLevel: 10,
      averageCost: 0,
      categoryId: electronicsId,
      supplierId: supplierAId,
    },
    {
      sku: 'SKU-ELEC-002',
      name: 'Mechanical Keyboard',
      description: 'RGB mechanical keyboard with Cherry MX switches',
      price: 85,
      stockQuantity: 0,
      reorderLevel: 5,
      averageCost: 0,
      categoryId: electronicsId,
      supplierId: supplierAId,
    },
    {
      sku: 'SKU-ELEC-003',
      name: '27-inch Monitor',
      description: '4K UHD monitor with IPS panel',
      price: 250,
      stockQuantity: 0,
      reorderLevel: 5,
      averageCost: 0,
      categoryId: electronicsId,
      supplierId: supplierAId,
    },
    {
      sku: 'SKU-STAT-001',
      name: 'Notebook A5',
      description: 'Premium A5 notebook with 120 pages',
      price: 5,
      stockQuantity: 0,
      reorderLevel: 20,
      averageCost: 0,
      categoryId: stationeryId,
      supplierId: supplierBId,
    },
    {
      sku: 'SKU-STAT-002',
      name: 'Ballpoint Pens (Pack of 10)',
      description: 'Smooth-writing ballpoint pens in assorted colors',
      price: 8.5,
      stockQuantity: 0,
      reorderLevel: 15,
      averageCost: 0,
      categoryId: stationeryId,
      supplierId: supplierBId,
    },
    {
      sku: 'SKU-FURN-001',
      name: 'Ergonomic Office Chair',
      description: 'Adjustable office chair with lumbar support',
      price: 150,
      stockQuantity: 0,
      reorderLevel: 3,
      averageCost: 0,
      categoryId: furnitureId,
      supplierId: supplierBId,
    },
  ];

  const products: Product[] = [];
  for (const pData of productsData) {
    const product = await prisma.product.create({
      data: { ...pData, tenantId },
    });
    products.push(product);
  }
  console.log(`✅ ${products.length} Products created.`);
  return products;
}
