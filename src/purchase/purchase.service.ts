import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { TransactionType, PurchaseOrderStatus, Prisma } from '@prisma/client';

interface PurchaseOrderItem {
  productId: number;
  quantity: number;
  unitPrice: string; // string to preserve Decimal precision
}

interface CreatePurchaseOrderDto {
  orderNumber: string;
  supplierId: number;
  userId: number;
  items: PurchaseOrderItem[];
  notes?: string;
}

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async createPurchaseOrder(data: CreatePurchaseOrderDto) {
    // Calculate total price using Decimal to avoid floating-point errors
    const totalPrice = data.items.reduce((acc, item) => {
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return acc.add(unitPrice.mul(item.quantity));
    }, new Prisma.Decimal(0));

    // Create purchase order and transactions in a single database transaction
    return this.prisma.$transaction(async (tx) => {
      // Create purchase order
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

      // Process each item
      for (const item of data.items) {
        // Fetch current product to calculate moving average cost
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        const currentStock = product.stockQuantity;
        const currentAvgCost = product.averageCost; // Already Prisma.Decimal
        const incomingQty = item.quantity;
        const incomingCost = new Prisma.Decimal(item.unitPrice);

        // Moving average cost using Decimal arithmetic (no floating-point error)
        const totalValueOld = currentAvgCost.mul(currentStock);
        const totalValueNew = incomingCost.mul(incomingQty);
        const newTotalStock = currentStock + incomingQty;

        const newAverageCost =
          newTotalStock > 0
            ? totalValueOld.add(totalValueNew).div(newTotalStock)
            : incomingCost;

        // Create IN stock transaction
        await tx.stockTransaction.create({
          data: {
            type: TransactionType.IN,
            quantity: item.quantity,
            referenceId: purchaseOrder.orderNumber,
            notes: 'Purchase Order Received',
            productId: item.productId,
            userId: data.userId,
          },
        });

        // Update product stock quantity and average cost
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity },
            averageCost: newAverageCost,
          },
        });
      }

      return purchaseOrder;
    });
  }

  async createPendingPurchaseOrder(data: CreatePurchaseOrderDto) {
    // Calculate total price using Decimal to avoid floating-point errors
    const totalPrice = data.items.reduce((acc, item) => {
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return acc.add(unitPrice.mul(item.quantity));
    }, new Prisma.Decimal(0));

    // Create purchase order without stock transactions
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

  async receivePurchaseOrder(orderId: number, userId: number) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(
        `Purchase Order with ID ${orderId} not found`,
      );
    }

    if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
      throw new Error(
        `Purchase Order ${purchaseOrder.orderNumber} is already received`,
      );
    }

    // Receive the order and process transactions
    return this.prisma.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: PurchaseOrderStatus.RECEIVED,
          receivedAt: new Date(),
        },
      });

      // Process each item
      for (const item of purchaseOrder.items) {
        // Fetch current product to calculate moving average cost
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        const currentStock = product.stockQuantity;
        const currentAvgCost = product.averageCost; // Already Prisma.Decimal
        const incomingQty = item.quantity;
        const incomingCost = item.unitPrice; // Already Prisma.Decimal from DB

        // Moving average cost using Decimal arithmetic (no floating-point error)
        const totalValueOld = currentAvgCost.mul(currentStock);
        const totalValueNew = incomingCost.mul(incomingQty);
        const newTotalStock = currentStock + incomingQty;

        const newAverageCost =
          newTotalStock > 0
            ? totalValueOld.add(totalValueNew).div(newTotalStock)
            : incomingCost;

        // Create IN stock transaction
        await tx.stockTransaction.create({
          data: {
            type: TransactionType.IN,
            quantity: item.quantity,
            referenceId: updatedOrder.orderNumber,
            notes: 'Purchase Order Received',
            productId: item.productId,
            userId,
          },
        });

        // Update product stock quantity and average cost
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity },
            averageCost: newAverageCost,
          },
        });
      }

      return updatedOrder;
    });
  }

  async getPurchaseOrders(options?: {
    skip?: number;
    take?: number;
    supplierId?: number;
    status?: PurchaseOrderStatus;
  }) {
    const where = {
      ...(options?.supplierId && { supplierId: options.supplierId }),
      ...(options?.status && { status: options.status }),
    };

    return this.prisma.purchaseOrder.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
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

  async getPurchaseOrderById(id: number) {
    const order = await this.prisma.purchaseOrder.findUnique({
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

    if (!order) {
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    return order;
  }

  async getSupplierPurchaseSummary(supplierId: number) {
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { supplierId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const totalOrders = purchaseOrders.length;

    // Use Decimal to sum totalSpent without floating-point error
    const totalSpentDecimal = purchaseOrders.reduce(
      (sum, order) => sum.add(order.totalPrice),
      new Prisma.Decimal(0),
    );
    const totalSpent = totalSpentDecimal.toNumber();

    const productsPurchased = new Map<
      number,
      { quantity: number; total: Prisma.Decimal }
    >();

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
      productsPurchased: Array.from(productsPurchased.entries()).map(
        ([productId, data]) => ({
          productId,
          quantity: data.quantity,
          total: data.total.toNumber(),
        }),
      ),
    };
  }
}
