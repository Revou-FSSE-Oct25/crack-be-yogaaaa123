import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, SalesOrderStatus, Prisma } from '@prisma/client';
import type { CreateSalesOrderDto as CreateSalesOrderDtoBase } from './dto/create-sales-order.dto';

interface CreateSalesOrderData extends CreateSalesOrderDtoBase {
  userId: string;
  tenantId: string;
}

interface SalesOrderItem {
  productId: string;
  quantity: number;
  unitPrice: string;
}

interface OrderItemData {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  cogs: Prisma.Decimal;
  profitMargin: Prisma.Decimal;
}

interface OrderItemsBuildResult {
  orderItemsToCreate: OrderItemData[];
  totalCogs: Prisma.Decimal;
  totalProfit: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async buildOrderItemsData(
    items: SalesOrderItem[],
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<OrderItemsBuildResult> {
    const productIds = items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalCogs = new Prisma.Decimal(0);
    let totalProfit = new Prisma.Decimal(0);
    let totalPrice = new Prisma.Decimal(0);
    const orderItemsToCreate: OrderItemData[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      const unitCost = product.averageCost;
      const itemUnitPrice = new Prisma.Decimal(item.unitPrice);

      const itemCogs = unitCost.mul(item.quantity);

      const itemProfitMargin = itemUnitPrice.sub(unitCost).mul(item.quantity);

      totalCogs = totalCogs.add(itemCogs);
      totalProfit = totalProfit.add(itemProfitMargin);
      totalPrice = totalPrice.add(itemUnitPrice.mul(item.quantity));

      orderItemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: itemUnitPrice,
        cogs: itemCogs,
        profitMargin: itemProfitMargin,
      });
    }

    return { orderItemsToCreate, totalCogs, totalProfit, totalPrice };
  }

  private async processStockOut(
    items: { productId: string; quantity: number }[],
    orderNumber: string,
    userId: string,
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const item of items) {
      let updatedProduct;
      try {
        updatedProduct = await tx.product.update({
          where: {
            id: item.productId,
            tenantId: tenantId,
            stockQuantity: { gte: item.quantity },
          },
          data: { stockQuantity: { decrement: item.quantity } },
          select: { stockQuantity: true, reorderLevel: true, name: true },
        });
      } catch (error: any) {
        if (error.code === 'P2025') {
          throw new BadRequestException(
            `Insufficient stock or product not found for ID ${item.productId}. Requested: ${item.quantity}`,
          );
        }
        throw error;
      }

      await tx.stockTransaction.create({
        data: {
          type: TransactionType.OUT,
          quantity: item.quantity,
          referenceId: orderNumber,
          notes: 'Sales Order Completed',
          productId: item.productId,
          userId,
          tenantId,
        },
      });

      const previousStock = updatedProduct.stockQuantity + item.quantity;
      const isJustBelowReorderLevel =
        previousStock > updatedProduct.reorderLevel &&
        updatedProduct.stockQuantity <= updatedProduct.reorderLevel;

      if (isJustBelowReorderLevel) {
        this.logger.warn(
          `Product "${updatedProduct.name}" stock (${updatedProduct.stockQuantity}) just dropped to or below reorder level (${updatedProduct.reorderLevel})!`,
        );
      }
    }
  }

  async createSalesOrder(data: CreateSalesOrderData) {
    return this.prisma.$transaction(async (tx) => {
      const { orderItemsToCreate, totalCogs, totalProfit, totalPrice } =
        await this.buildOrderItemsData(data.items, tx, data.tenantId);

      const salesOrder = await tx.salesOrder.create({
        data: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          status: 'COMPLETED',
          totalPrice,
          totalCogs,
          totalProfit,
          userId: data.userId,
          tenantId: data.tenantId,
          items: { create: orderItemsToCreate },
        },
      });

      await this.processStockOut(
        data.items,
        salesOrder.orderNumber,
        data.userId,
        data.tenantId,
        tx,
      );

      return salesOrder;
    });
  }

  async createPendingSalesOrder(data: CreateSalesOrderData) {
    return this.prisma.$transaction(async (tx) => {
      const { orderItemsToCreate, totalCogs, totalProfit, totalPrice } =
        await this.buildOrderItemsData(data.items, tx, data.tenantId);

      return tx.salesOrder.create({
        data: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          status: 'PENDING',
          totalPrice,
          totalCogs,
          totalProfit,
          userId: data.userId,
          tenantId: data.tenantId,
          items: { create: orderItemsToCreate },
        },
      });
    });
  }

  async completeSalesOrder(orderId: string, userId: string, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const salesOrder = await tx.salesOrder.findFirst({
        where: { id: orderId, status: 'PENDING', tenantId },
        include: { items: true },
      });

      if (!salesOrder) {
        const exists = await tx.salesOrder.findFirst({
          where: { id: orderId, tenantId },
          select: { id: true, status: true },
        });
        if (!exists) {
          throw new BadRequestException(`Sales Order ${orderId} not found`);
        }
        throw new BadRequestException(
          `Only PENDING orders can be completed. Current status: ${exists.status}`,
        );
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
      });

      const itemsForStockOut = salesOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      await this.processStockOut(itemsForStockOut, updatedOrder.orderNumber, userId, tenantId, tx);

      return updatedOrder;
    });
  }

  async getSalesOrders(
    tenantId: string,
    options?: {
      skip?: number;
      take?: number;
      customerId?: string;
      status?: SalesOrderStatus;
    },
  ) {
    const prisma = this.prisma.getClient(tenantId);
    const where = {
      ...(options?.customerId && { customerId: options.customerId }),
      ...(options?.status && { status: options.status }),
    };

    return prisma.salesOrder.findMany({
      where,
      skip: options?.skip,
      take: options?.take ?? 50,
      orderBy: { createdAt: 'desc' },
      include: {
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

  async getSalesOrderById(tenantId: string, id: string) {
    const prisma = this.prisma.getClient(tenantId);
    const order = await prisma.salesOrder.findFirst({
      where: { id },
      include: {
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
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Sales Order ${id} not found`);
    }
    return order;
  }

  async cancelSalesOrder(orderId: string, tenantId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.salesOrder.updateMany({
        where: {
          id: orderId,
          tenantId,
          status: 'PENDING',
        },
        data: { status: 'CANCELLED' },
      });

      if (updateResult.count === 0) {
        const exists = await tx.salesOrder.findFirst({
          where: { id: orderId, tenantId },
          select: { id: true, status: true },
        });

        if (!exists) {
          throw new NotFoundException(`Sales Order ${orderId} not found`);
        }

        throw new BadRequestException(
          `Only PENDING orders can be cancelled. Current status: ${exists.status}`,
        );
      }

      const updated = await tx.salesOrder.findFirst({
        where: { id: orderId, tenantId },
      });
      if (!updated) {
        throw new NotFoundException(`Sales Order ${orderId} not found after cancellation`);
      }
      return updated;
    });

    return result;
  }
}
