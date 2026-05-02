import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType, SalesOrderStatus, Prisma } from '@prisma/client';
import type { CreateSalesOrderDto as CreateSalesOrderDtoBase } from './dto/create-sales-order.dto';

// Extend DTO with server-side userId (injected by controller from JWT)
interface CreateSalesOrderData extends CreateSalesOrderDtoBase {
  userId: string;
  tenantId: string;
}

// Alias for use in internal helpers
interface SalesOrderItem {
  productId: string;
  quantity: number;
  unitPrice: string;
}

// Shape of each item ready for DB insertion
interface OrderItemData {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  cogs: Prisma.Decimal; // total COGS for this item (unitCost * quantity)
  profitMargin: Prisma.Decimal; // total profit for this item ((unitPrice - unitCost) * quantity)
}

// Aggregated result from buildOrderItemsData
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

  /**
   * Private helper: calculate COGS, profit, and prepare order items data.
   * Extracted to eliminate duplication between createSalesOrder & createPendingSalesOrder.
   */
  private async buildOrderItemsData(
    items: SalesOrderItem[],
    tx: Prisma.TransactionClient,
  ): Promise<OrderItemsBuildResult> {
    const productIds = items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
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

      const unitCost = product.averageCost; // Already Prisma.Decimal
      const itemUnitPrice = new Prisma.Decimal(item.unitPrice);

      // Decimal arithmetic — no floating-point error
      // cogs = unitCost * quantity (TOTAL cost for all quantity of this item)
      const itemCogs = unitCost.mul(item.quantity);
      // profitMargin = (unitPrice - unitCost) * quantity (TOTAL profit for this item)
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

  /**
   * Private helper: decrement stock and create StockTransaction OUT for each item.
   * Uses pessimistic check within the transaction for race condition safety.
   */
  private async processStockOut(
    items: { productId: string; quantity: number }[],
    orderNumber: string,
    userId: string,
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const item of items) {
      // Atomic stock validation: only decrement if stock is sufficient
      const updatedProduct = await tx.product.update({
        where: {
          id: item.productId,
          stockQuantity: { gte: item.quantity },
        },
        data: { stockQuantity: { decrement: item.quantity } },
        select: { stockQuantity: true, reorderLevel: true, name: true },
      });

      if (!updatedProduct) {
        throw new BadRequestException(
          `Insufficient stock for product ID ${item.productId}. Requested: ${item.quantity}`,
        );
      }

      // Create OUT stock transaction
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

      // Log warning ONLY if stock just dropped below reorder level
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
      // Build order items data (COGS, profit, price) — pre-check stock omitted,
      // pessimistic check in processStockOut is sufficient and more atomic
      const { orderItemsToCreate, totalCogs, totalProfit, totalPrice } =
        await this.buildOrderItemsData(data.items, tx);

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

      // Decrement stock and create stock transactions
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
      // Build order items data — no stock processing since status is PENDING
      const { orderItemsToCreate, totalCogs, totalProfit, totalPrice } =
        await this.buildOrderItemsData(data.items, tx);

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
      // Atomic status check + update — prevents race conditions from concurrent requests.
      const salesOrder = await tx.salesOrder.findFirst({
        where: { id: orderId, status: 'PENDING' },
        include: { items: true },
      });

      if (!salesOrder) {
        // Check if it exists at all for a more descriptive error
        const exists = await tx.salesOrder.findFirst({
          where: { id: orderId },
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

      // Convert OrderItem (from DB) for stock helper
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
      take: options?.take ?? 50, // Default limit 50 to prevent unbounded queries
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

  /**
   * Cancel a PENDING sales order.
   * Only PENDING orders can be cancelled — no stock impact.
   */
  async cancelSalesOrder(orderId: string, _tenantId: string) {
    // Atomic check-and-set: only update if status is still PENDING
    const result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.salesOrder.updateMany({
        where: {
          id: orderId,
          status: 'PENDING', // ← Atomic condition: only PENDING orders
        },
        data: { status: 'CANCELLED' },
      });

      if (updateResult.count === 0) {
        // updateMany didn't update anything — check why
        const exists = await tx.salesOrder.findFirst({
          where: { id: orderId },
          select: { id: true, status: true },
        });

        if (!exists) {
          throw new NotFoundException(`Sales Order ${orderId} not found`);
        }

        throw new BadRequestException(
          `Only PENDING orders can be cancelled. Current status: ${exists.status}`,
        );
      }

      // Fetch and return the updated order for the response
      const updated = await tx.salesOrder.findFirst({
        where: { id: orderId },
      });
      if (!updated) {
        throw new NotFoundException(`Sales Order ${orderId} not found after cancellation`);
      }
      return updated;
    });

    return result;
  }
}
