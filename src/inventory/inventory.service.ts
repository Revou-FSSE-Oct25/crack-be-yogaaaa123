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
    quantityChange: number,
    type: TransactionType,
    referenceId?: string,
    notes?: string,
  ) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    // Determine the operation based on type and quantityChange.
    // If it's an OUT transaction, we decrement. If IN, we increment.
    // For ADJUSTMENT, we can use increment with a positive or negative quantityChange.
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
      // Create stock transaction
      const transaction = await tx.stockTransaction.create({
        data: {
          type,
          quantity: absoluteChange,
          referenceId,
          notes,
          productId,
          userId,
        },
      });

      // Update product stock quantity
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stockQuantity: {
            [operation]: absoluteChange,
          },
        },
      });

      if (updatedProduct.stockQuantity < 0) {
        throw new BadRequestException(
          `Insufficient stock for product ID ${productId}. Stock cannot be negative.`,
        );
      }

      return { transaction, product: updatedProduct };
    });
  }

  async checkStockAvailability(productId: string, requestedQuantity: number) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stockQuantity: true, name: true },
    });

    if (product.stockQuantity < requestedQuantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${requestedQuantity}`,
      );
    }

    return product;
  }

  async checkReorderLevel(productId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        stockQuantity: true,
        reorderLevel: true,
        name: true,
        sku: true,
      },
    });

    return {
      ...product,
      isBelowReorderLevel: product.stockQuantity <= product.reorderLevel,
    };
  }

  /**
   * Get all products where stockQuantity <= reorderLevel.
   * Uses raw SQL because Prisma ORM doesn't support column-to-column comparison.
   */
  async getLowStockProducts(): Promise<LowStockProduct[]> {
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
        ORDER BY p."stockQuantity" ASC
      `,
    );
  }
}
