import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async adjustStock(
    productId: number,
    userId: number,
    quantityChange: number,
    type: TransactionType,
    referenceId?: string,
    notes?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

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
        throw new Error(
          `Insufficient stock for product ID ${productId}. Stock cannot be negative.`,
        );
      }

      return { transaction, product: updatedProduct };
    });
  }

  async checkStockAvailability(productId: number, requestedQuantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { stockQuantity: true, name: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.stockQuantity < requestedQuantity) {
      throw new Error(
        `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${requestedQuantity}`,
      );
    }

    return product;
  }

  async checkReorderLevel(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        stockQuantity: true,
        reorderLevel: true,
        name: true,
        sku: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return {
      ...product,
      isBelowReorderLevel: product.stockQuantity <= product.reorderLevel,
    };
  }

  async getLowStockProducts() {
    return this.prisma.product.findMany({
      where: {
        stockQuantity: {
          lte: this.prisma.product.fields.reorderLevel,
        },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        stockQuantity: true,
        reorderLevel: true,
        supplier: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}
