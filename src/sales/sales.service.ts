import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { TransactionType, SalesOrderStatus, Prisma } from '@prisma/client';

interface SalesOrderItem {
  productId: number;
  quantity: number;
  unitPrice: string; // string to preserve Decimal precision
}

interface CreateSalesOrderDto {
  orderNumber: string;
  customerId?: string;
  userId: number;
  items: SalesOrderItem[];
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async createSalesOrder(data: CreateSalesOrderDto) {
    // Validate all items before processing
    for (const item of data.items) {
      await this.inventoryService.checkStockAvailability(
        item.productId,
        item.quantity,
      );
    }

    // Calculate total price using Decimal to avoid floating-point errors
    const totalPrice = data.items.reduce((acc, item) => {
      return acc.add(new Prisma.Decimal(item.unitPrice).mul(item.quantity));
    }, new Prisma.Decimal(0));

    // Create sales order and transactions in a single database transaction
    return this.prisma.$transaction(async (tx) => {
      let totalCogs = new Prisma.Decimal(0);
      let totalProfit = new Prisma.Decimal(0);
      const orderItemsToCreate: {
        productId: number;
        quantity: number;
        unitPrice: Prisma.Decimal;
        cogs: Prisma.Decimal;
        profitMargin: Prisma.Decimal;
      }[] = [];

      const productIds = data.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of data.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        const unitCost = product.averageCost; // Already Prisma.Decimal
        const itemUnitPrice = new Prisma.Decimal(item.unitPrice);

        // Decimal arithmetic — no floating-point error
        const itemCogs = unitCost.mul(item.quantity);
        const itemProfitMargin = itemUnitPrice.sub(unitCost).mul(item.quantity);

        totalCogs = totalCogs.add(itemCogs);
        totalProfit = totalProfit.add(itemProfitMargin);

        orderItemsToCreate.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: itemUnitPrice,
          cogs: unitCost,
          profitMargin: itemProfitMargin,
        });
      }

      // Create sales order
      const salesOrder = await tx.salesOrder.create({
        data: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          status: 'COMPLETED',
          totalPrice,
          totalCogs,
          totalProfit,
          userId: data.userId,
          items: {
            create: orderItemsToCreate,
          },
        },
      });

      // Process each item
      for (const item of data.items) {
        // Update product stock quantity and get updated values
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
          select: { stockQuantity: true, reorderLevel: true, name: true },
        });

        // Pessimistic check: If stock goes below 0, rollback the transaction
        if (updatedProduct.stockQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for product ${updatedProduct.name}. Requested: ${item.quantity}`,
          );
        }

        // Create OUT stock transaction
        await tx.stockTransaction.create({
          data: {
            type: TransactionType.OUT,
            quantity: item.quantity,
            referenceId: salesOrder.orderNumber,
            notes: 'Sales Order Completed',
            productId: item.productId,
            userId: data.userId,
          },
        });

        // Check reorder level using the updated data
        if (updatedProduct.stockQuantity <= updatedProduct.reorderLevel) {
          this.logger.warn(
            `Product "${updatedProduct.name}" stock (${updatedProduct.stockQuantity}) is at or below reorder level (${updatedProduct.reorderLevel})`,
          );
        }
      }

      return salesOrder;
    });
  }

  async createPendingSalesOrder(data: CreateSalesOrderDto) {
    // Calculate total price using Decimal to avoid floating-point errors
    const totalPrice = data.items.reduce((acc, item) => {
      return acc.add(new Prisma.Decimal(item.unitPrice).mul(item.quantity));
    }, new Prisma.Decimal(0));

    // Create sales order without stock transactions
    return this.prisma.$transaction(async (tx) => {
      let totalCogs = new Prisma.Decimal(0);
      let totalProfit = new Prisma.Decimal(0);
      const orderItemsToCreate: {
        productId: number;
        quantity: number;
        unitPrice: Prisma.Decimal;
        cogs: Prisma.Decimal;
        profitMargin: Prisma.Decimal;
      }[] = [];

      const productIds = data.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of data.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        const unitCost = product.averageCost; // Already Prisma.Decimal
        const itemUnitPrice = new Prisma.Decimal(item.unitPrice);

        // Decimal arithmetic — no floating-point error
        const itemCogs = unitCost.mul(item.quantity);
        const itemProfitMargin = itemUnitPrice.sub(unitCost).mul(item.quantity);

        totalCogs = totalCogs.add(itemCogs);
        totalProfit = totalProfit.add(itemProfitMargin);

        orderItemsToCreate.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: itemUnitPrice,
          cogs: unitCost,
          profitMargin: itemProfitMargin,
        });
      }

      return tx.salesOrder.create({
        data: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          status: 'PENDING',
          totalPrice,
          totalCogs,
          totalProfit,
          userId: data.userId,
          items: {
            create: orderItemsToCreate,
          },
        },
      });
    });
  }

  async completeSalesOrder(orderId: number, userId: number) {
    const salesOrder = await this.prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!salesOrder) {
      throw new NotFoundException(`Sales Order with ID ${orderId} not found`);
    }

    if (salesOrder.status === 'COMPLETED') {
      throw new BadRequestException(
        `Sales Order ${salesOrder.orderNumber} is already completed`,
      );
    }

    // Validate stock availability
    for (const item of salesOrder.items) {
      await this.inventoryService.checkStockAvailability(
        item.productId,
        item.quantity,
      );
    }

    // Complete the order and process transactions
    return this.prisma.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
      });

      // Process each item
      for (const item of salesOrder.items) {
        // Update product stock quantity and get updated values
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
          select: { stockQuantity: true, reorderLevel: true, name: true },
        });

        // Pessimistic check: If stock goes below 0, rollback the transaction
        if (updatedProduct.stockQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for product ${updatedProduct.name}. Requested: ${item.quantity}`,
          );
        }

        // Create OUT stock transaction
        await tx.stockTransaction.create({
          data: {
            type: TransactionType.OUT,
            quantity: item.quantity,
            referenceId: updatedOrder.orderNumber,
            notes: 'Sales Order Completed',
            productId: item.productId,
            userId,
          },
        });

        // Check reorder level using the updated data
        if (updatedProduct.stockQuantity <= updatedProduct.reorderLevel) {
          this.logger.warn(
            `Product "${updatedProduct.name}" stock (${updatedProduct.stockQuantity}) is at or below reorder level (${updatedProduct.reorderLevel})`,
          );
        }
      }

      return updatedOrder;
    });
  }

  async getSalesOrders(options?: {
    skip?: number;
    take?: number;
    customerId?: string;
    status?: SalesOrderStatus;
  }) {
    const where = {
      ...(options?.customerId && { customerId: options.customerId }),
      ...(options?.status && { status: options.status }),
    };

    return this.prisma.salesOrder.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
      include: {
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

  async getSalesOrderById(id: number) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
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
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Sales Order with ID ${id} not found`);
    }

    return order;
  }
}
