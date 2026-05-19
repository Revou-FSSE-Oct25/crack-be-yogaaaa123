import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, Prisma } from '@prisma/client';

export interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stockQuantity: number;
  reorderLevel: number;
  supplierName: string | null;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async adjustStock(
    productId: string,
    userId: string,
    tenantId: string,
    quantityChange: number,
    type: TransactionType,
    referenceId?: string,
    notes?: string,
  ) {
    const prisma = this.prisma.getClient(tenantId);
    await prisma.product.findFirst({
      where: { id: productId },
    });

    let operation: 'increment' | 'decrement' = 'increment';
    const absoluteChange = Math.abs(quantityChange);

    if (type === TransactionType.OUT) {
      operation = 'decrement';
    } else if (type === TransactionType.IN) {
      operation = 'increment';
    } else {
      operation = quantityChange < 0 ? 'decrement' : 'increment';
    }

    return this.prisma.$transaction(async (tx: any) => {
      if (operation === 'decrement') {
        let updatedProduct;
        try {
          updatedProduct = await tx.product.update({
            where: {
              id: productId,
              tenantId,
              stockQuantity: { gte: absoluteChange },
            },
            data: {
              stockQuantity: {
                decrement: absoluteChange,
              },
            },
          });
        } catch (error: any) {
          if (error.code === 'P2025') {
            throw new BadRequestException(
              `Insufficient stock or product not found for ID ${productId}. Cannot decrement by ${absoluteChange}.`,
            );
          }
          throw error;
        }

        const transaction = await tx.stockTransaction.create({
          data: {
            type,
            quantity: absoluteChange,
            referenceId,
            notes,
            productId,
            userId,
            tenantId,
          },
        });

        return { transaction, product: updatedProduct };
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId, tenantId },
        data: {
          stockQuantity: {
            increment: absoluteChange,
          },
        },
      });

      const transaction = await tx.stockTransaction.create({
        data: {
          type,
          quantity: absoluteChange,
          referenceId,
          notes,
          productId,
          userId,
          tenantId,
        },
      });

      return { transaction, product: updatedProduct };
    });
  }

  async aiProductInput(
    products: {
      sku: string;
      name: string;
      price: string;
      stockQuantity?: number;
      reorderLevel?: number;
      categoryName?: string;
      supplierName?: string;
    }[],
    tenantId: string,
  ) {
    const prisma = this.prisma.getClient(tenantId);
    const created: Record<string, unknown>[] = [];
    const warnings: string[] = [];
    let skipped = 0;

    for (const item of products) {
      const existing = await prisma.product.findUnique({
        where: { tenantId_sku: { tenantId, sku: item.sku } },
      });
      if (existing) {
        warnings.push(`SKU ${item.sku} already exists`);
        skipped++;
        continue;
      }

      let categoryId: string | undefined;
      if (item.categoryName) {
        const cat = await prisma.category.upsert({
          where: { tenantId_name: { tenantId, name: item.categoryName } },
          create: { name: item.categoryName, tenantId },
          update: {},
        });
        categoryId = cat.id;
      }

      let supplierId: string | undefined;
      if (item.supplierName) {
        const sup = await prisma.supplier.upsert({
          where: { tenantId_name: { tenantId, name: item.supplierName } },
          create: { name: item.supplierName, tenantId },
          update: {},
        });
        supplierId = sup.id;
      }

      const product = await prisma.product.create({
        data: {
          sku: item.sku,
          name: item.name,
          price: item.price,
          stockQuantity: item.stockQuantity ?? 0,
          reorderLevel: item.reorderLevel ?? 10,
          categoryId,
          supplierId,
          tenantId,
        },
      });
      created.push(product);
    }

    return { created: created.length, skipped, warnings, products: created };
  }

  async checkStockAvailability(productId: string, requestedQuantity: number, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const product = await prisma.product.findFirst({
      where: { id: productId },
      select: { stockQuantity: true, name: true },
    });

    if (!product) {
      throw new BadRequestException(`Product ${productId} not found`);
    }

    if (product.stockQuantity < requestedQuantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${requestedQuantity}`,
      );
    }

    return product;
  }

  async checkReorderLevel(productId: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const product = await prisma.product.findFirst({
      where: { id: productId },
      select: {
        stockQuantity: true,
        reorderLevel: true,
        name: true,
        sku: true,
      },
    });

    if (!product) {
      throw new BadRequestException(`Product ${productId} not found`);
    }

    return {
      ...product,
      isBelowReorderLevel: product.stockQuantity <= product.reorderLevel,
    };
  }

  async getLowStockProducts(tenantId: string): Promise<LowStockProduct[]> {
    return this.prisma.$queryRaw<LowStockProduct[]>(
      Prisma.sql`
        SELECT
          p.id,
          p.sku,
          p.name,
          p."stockQuantity",
          p."reorderLevel",
          s.name AS "supplierName"
        FROM products p
        LEFT JOIN suppliers s ON p."supplierId" = s.id
        WHERE p."stockQuantity" <= p."reorderLevel"
          AND p."deletedAt" IS NULL
          AND p."tenantId" = ${tenantId}
        ORDER BY p."stockQuantity" ASC
      `,
    );
  }
}
