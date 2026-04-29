import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType, PurchaseOrderStatus, Prisma } from '@prisma/client';

interface PurchaseOrderItem {
  productId: string;
  quantity: number;
  unitPrice: string; // string to preserve Decimal precision
}

interface CreatePurchaseOrderDto {
  orderNumber: string;
  supplierId: string;
  userId: string;
  items: PurchaseOrderItem[];
  notes?: string;
}

// Shape dari item yang sudah ada di DB (saat receivePurchaseOrder)
interface DbPurchaseOrderItem {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal; // sudah Decimal dari DB
}

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaService) {}

  private calculateTotalPrice(items: PurchaseOrderItem[]): Prisma.Decimal {
    return items.reduce((acc, item) => {
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return acc.add(unitPrice.mul(item.quantity));
    }, new Prisma.Decimal(0));
  }

  /**
   * Private helper: proses stock IN dan update moving average cost untuk setiap item.
   * Di-extract untuk menghindari duplikasi antara createPurchaseOrder & receivePurchaseOrder.
   */
  private async processReceivedItems(
    items: DbPurchaseOrderItem[],
    orderNumber: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const productIds = items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      // Prisma guarantee: foreign key ensures product exists since purchaseOrder insert succeeded
      const product = productMap.get(item.productId)!;

      const currentStock = product.stockQuantity;
      const currentAvgCost = product.averageCost; // Already Prisma.Decimal
      const incomingQty = item.quantity;
      const incomingCost = item.unitPrice; // Already Prisma.Decimal

      // Moving average cost menggunakan Decimal arithmetic (no floating-point error)
      const totalValueOld = currentAvgCost.mul(currentStock);
      const totalValueNew = incomingCost.mul(incomingQty);
      const newTotalStock = currentStock + incomingQty;

      const newAverageCost =
        newTotalStock > 0 ? totalValueOld.add(totalValueNew).div(newTotalStock) : incomingCost;

      // Create IN stock transaction
      await tx.stockTransaction.create({
        data: {
          type: TransactionType.IN,
          quantity: item.quantity,
          referenceId: orderNumber,
          notes: 'Purchase Order Received',
          productId: item.productId,
          userId,
        },
      });

      // Update product stock quantity dan average cost
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: { increment: item.quantity },
          averageCost: newAverageCost,
        },
      });
    }
  }

  async createPurchaseOrder(data: CreatePurchaseOrderDto) {
    const totalPrice = this.calculateTotalPrice(data.items);

    return this.prisma.$transaction(async (tx) => {
      // Buat purchase order
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          orderNumber: data.orderNumber,
          totalPrice,
          status: PurchaseOrderStatus.RECEIVED,
          notes: data.notes,
          supplierId: data.supplierId,
          userId: data.userId,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
            })),
          },
          receivedAt: new Date(),
        },
      });

      // Konversi items ke format DbPurchaseOrderItem untuk helper
      const dbItems: DbPurchaseOrderItem[] = data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
      }));

      await this.processReceivedItems(dbItems, purchaseOrder.orderNumber, data.userId, tx);

      return purchaseOrder;
    });
  }

  async createPendingPurchaseOrder(data: CreatePurchaseOrderDto) {
    const totalPrice = this.calculateTotalPrice(data.items);

    // Buat purchase order tanpa stock transaction (status PENDING)
    return this.prisma.purchaseOrder.create({
      data: {
        orderNumber: data.orderNumber,
        totalPrice,
        status: PurchaseOrderStatus.PENDING,
        notes: data.notes,
        supplierId: data.supplierId,
        userId: data.userId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
          })),
        },
      },
    });
  }

  async receivePurchaseOrder(orderId: string, userId: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        `Purchase Order ${purchaseOrder.orderNumber} is already received`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: PurchaseOrderStatus.RECEIVED,
          receivedAt: new Date(),
        },
      });

      // Proses setiap item menggunakan shared helper
      await this.processReceivedItems(purchaseOrder.items, updatedOrder.orderNumber, userId, tx);

      return updatedOrder;
    });
  }

  async getPurchaseOrders(options?: {
    skip?: number;
    take?: number;
    supplierId?: string;
    status?: PurchaseOrderStatus;
  }) {
    const where = {
      ...(options?.supplierId && { supplierId: options.supplierId }),
      ...(options?.status && { status: options.status }),
    };

    return this.prisma.purchaseOrder.findMany({
      where,
      skip: options?.skip,
      take: options?.take ?? 50, // Default limit 50 untuk mencegah query tanpa batas
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: {
          select: {
            name: true,
            contactName: true,
            phone: true,
          },
        },
        user: {
          select: {
            username: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                sku: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getPurchaseOrderById(id: string) {
    return this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true,
            phone: true,
            email: true,
          },
        },
        user: {
          select: {
            username: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                price: true,
                stockQuantity: true,
              },
            },
          },
        },
      },
    });
  }

  async getSupplierPurchaseSummary(supplierId: string) {
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        deletedAt: null, // Filter soft-deleted orders
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const totalOrders = purchaseOrders.length;

    // Gunakan Decimal untuk menjumlahkan totalSpent tanpa floating-point error
    const totalSpentDecimal = purchaseOrders.reduce(
      (sum, order) => sum.add(order.totalPrice),
      new Prisma.Decimal(0),
    );
    const totalSpent = totalSpentDecimal.toNumber();

    const productsPurchased = new Map<string, { quantity: number; total: Prisma.Decimal }>();

    purchaseOrders.forEach((order) => {
      order.items.forEach((item) => {
        const current = productsPurchased.get(item.productId) || {
          quantity: 0,
          total: new Prisma.Decimal(0),
        };
        productsPurchased.set(item.productId, {
          quantity: current.quantity + item.quantity,
          total: current.total.add(item.unitPrice.mul(item.quantity)),
        });
      });
    });

    return {
      totalOrders,
      totalSpent,
      productsPurchased: Array.from(productsPurchased.entries()).map(([productId, data]) => ({
        productId,
        quantity: data.quantity,
        total: data.total.toNumber(),
      })),
    };
  }

  /**
   * Cancel a PENDING purchase order.
   * Only PENDING orders can be cancelled — no stock impact.
   */
  async cancelPurchaseOrder(orderId: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: orderId },
    });

    if (purchaseOrder.status !== 'PENDING') {
      throw new BadRequestException(
        `Only PENDING orders can be cancelled. Current status: ${purchaseOrder.status}`,
      );
    }

    return this.prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
  }
}
