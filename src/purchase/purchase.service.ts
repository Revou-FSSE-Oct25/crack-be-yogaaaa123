import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType, PurchaseOrderStatus, Prisma } from '@prisma/client';

interface PurchaseOrderItem {
  productId: string;
  quantity: number;
  unitPrice: string;
}

interface CreatePurchaseOrderDto {
  orderNumber: string;
  supplierId: string;
  userId: string;
  tenantId: string;
  items: PurchaseOrderItem[];
  notes?: string;
}

interface DbPurchaseOrderItem {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
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

  private async processReceivedItems(
    items: DbPurchaseOrderItem[],
    orderNumber: string,
    userId: string,
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const productIds = items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId)!;

      const currentStock = product.stockQuantity;
      const currentAvgCost = product.averageCost;
      const incomingQty = item.quantity;
      const incomingCost = item.unitPrice;

      const totalValueOld = currentAvgCost.mul(currentStock);
      const totalValueNew = incomingCost.mul(incomingQty);
      const newTotalStock = currentStock + incomingQty;

      const newAverageCost =
        newTotalStock > 0 ? totalValueOld.add(totalValueNew).div(newTotalStock) : incomingCost;

      await tx.stockTransaction.create({
        data: {
          type: TransactionType.IN,
          quantity: item.quantity,
          referenceId: orderNumber,
          notes: 'Purchase Order Received',
          productId: item.productId,
          userId,
          tenantId,
        },
      });

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
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          orderNumber: data.orderNumber,
          totalPrice,
          status: PurchaseOrderStatus.RECEIVED,
          notes: data.notes,
          supplierId: data.supplierId,
          userId: data.userId,
          tenantId: data.tenantId,
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

      const dbItems: DbPurchaseOrderItem[] = data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
      }));

      await this.processReceivedItems(
        dbItems,
        purchaseOrder.orderNumber,
        data.userId,
        data.tenantId,
        tx,
      );

      return purchaseOrder;
    });
  }

  async createPendingPurchaseOrder(data: CreatePurchaseOrderDto) {
    const totalPrice = this.calculateTotalPrice(data.items);

    return this.prisma.$transaction(async (tx) => {
      return tx.purchaseOrder.create({
        data: {
          orderNumber: data.orderNumber,
          totalPrice,
          status: PurchaseOrderStatus.PENDING,
          notes: data.notes,
          supplierId: data.supplierId,
          userId: data.userId,
          tenantId: data.tenantId,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
            })),
          },
        },
      });
    });
  }

  async receivePurchaseOrder(orderId: string, userId: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: orderId },
      include: { items: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase Order ${orderId} not found`);
    }

    if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        `Purchase Order ${purchaseOrder.orderNumber} is already received`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: PurchaseOrderStatus.RECEIVED,
          receivedAt: new Date(),
        },
      });

      await this.processReceivedItems(
        purchaseOrder.items,
        updatedOrder.orderNumber,
        userId,
        tenantId,
        tx,
      );

      return updatedOrder;
    });
  }

  async getPurchaseOrders(
    tenantId: string,
    options?: {
      skip?: number;
      take?: number;
      supplierId?: string;
      status?: PurchaseOrderStatus;
    },
  ) {
    const prisma = this.prisma.getClient(tenantId);
    const where = {
      ...(options?.supplierId && { supplierId: options.supplierId }),
      ...(options?.status && { status: options.status }),
    };

    return prisma.purchaseOrder.findMany({
      where,
      skip: options?.skip,
      take: options?.take ?? 50,
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

  async getPurchaseOrderById(tenantId: string, id: string) {
    const prisma = this.prisma.getClient(tenantId);
    const order = await prisma.purchaseOrder.findFirst({
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
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }
    return order;
  }

  async getSupplierPurchaseSummary(tenantId: string, supplierId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        supplierId,
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

  async cancelPurchaseOrder(orderId: string, _tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.purchaseOrder.updateMany({
        where: {
          id: orderId,
          status: 'PENDING',
        },
        data: { status: 'CANCELLED' },
      });

      if (updateResult.count === 0) {
        const exists = await tx.purchaseOrder.findFirst({
          where: { id: orderId },
          select: { id: true, status: true },
        });

        if (!exists) {
          throw new NotFoundException(`Purchase Order ${orderId} not found`);
        }

        throw new BadRequestException(
          `Only PENDING orders can be cancelled. Current status: ${exists.status}`,
        );
      }

      const updated = await tx.purchaseOrder.findFirst({
        where: { id: orderId },
      });
      if (!updated) {
        throw new NotFoundException(`Purchase Order ${orderId} not found after cancellation`);
      }
      return updated;
    });
  }
}
