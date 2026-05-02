import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
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

    // Determine the operation based on type and quantityChange.
    let operation: 'increment' | 'decrement' = 'increment';
    const absoluteChange = Math.abs(quantityChange);

    if (type === TransactionType.OUT) {
      operation = 'decrement';
    } else if (type === TransactionType.IN) {
      operation = 'increment';
    } else {
      // ADJUSTMENT: if quantityChange is negative, we decrement.
      operation = quantityChange < 0 ? 'decrement' : 'increment';
    }

    return this.prisma.$transaction(async (tx) => {
      // Atomic stock validation: only decrement if stock is sufficient
      if (operation === 'decrement') {
        const updatedProduct = await tx.product.update({
          where: {
            id: productId,
            stockQuantity: { gte: absoluteChange },
          },
          data: {
            stockQuantity: {
              decrement: absoluteChange,
            },
          },
        });

        if (!updatedProduct) {
          throw new BadRequestException(
            `Insufficient stock for product ID ${productId}. Cannot decrement by ${absoluteChange}.`,
          );
        }

        // Create stock transaction
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

      // For increment operations, just update directly
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stockQuantity: {
            increment: absoluteChange,
          },
        },
      });

      // Create stock transaction
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

  /**
   * Get all products where stockQuantity <= reorderLevel.
   * Uses raw SQL because Prisma ORM doesn't support column-to-column comparison.
   */
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
