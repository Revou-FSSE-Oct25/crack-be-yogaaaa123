import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType, SalesOrderStatus, Prisma } from '@prisma/client';
import type { CreateSalesOrderDto as CreateSalesOrderDtoBase } from './dto/create-sales-order.dto';

// Extend DTO with server-side userId (injected by controller from JWT)
interface CreateSalesOrderData extends CreateSalesOrderDtoBase {
  userId: string;
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
  cogs: Prisma.Decimal; // total COGS untuk item ini (unitCost * quantity)
  profitMargin: Prisma.Decimal; // total profit untuk item ini ((unitPrice - unitCost) * quantity)
}

// Aggregated result dari buildOrderItemsData
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
   * Private helper: hitung COGS, profit, dan siapkan data order items.
   * Di-extract untuk menghilangkan duplikasi antara createSalesOrder & createPendingSalesOrder.
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
      // cogs = unitCost * quantity (TOTAL cost untuk seluruh quantity item ini)
      const itemCogs = unitCost.mul(item.quantity);
      // profitMargin = (unitPrice - unitCost) * quantity (TOTAL profit item ini)
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
   * Private helper: decrement stok dan buat StockTransaction OUT untuk setiap item.
   * Menggunakan pessimistic check di dalam transaksi untuk race condition safety.
   */
  private async processStockOut(
    items: { productId: string; quantity: number }[],
    orderNumber: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const item of items) {
      const updatedProduct = await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
        select: { stockQuantity: true, reorderLevel: true, name: true },
      });

      // Pessimistic check: Jika stok jadi negatif, rollback transaksi
      if (updatedProduct.stockQuantity < 0) {
        throw new BadRequestException(
          `Insufficient stock for product ${updatedProduct.name}. Requested: ${item.quantity}`,
        );
      }

      // Buat OUT stock transaction
      await tx.stockTransaction.create({
        data: {
          type: TransactionType.OUT,
          quantity: item.quantity,
          referenceId: orderNumber,
          notes: 'Sales Order Completed',
          productId: item.productId,
          userId,
        },
      });

      // Log warning HANYA JIKA stok baru saja melewati batas reorder level
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
      // Build order items data (COGS, profit, price) — pre-check stok ditiadakan,
      // pessimistic check di processStockOut sudah cukup dan lebih atomic
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
          items: { create: orderItemsToCreate },
        },
      });

      // Decrement stok dan buat stock transactions
      await this.processStockOut(
        data.items,
        salesOrder.orderNumber,
        data.userId,
        tx,
      );

      return salesOrder;
    });
  }

  async createPendingSalesOrder(data: CreateSalesOrderData) {
    return this.prisma.$transaction(async (tx) => {
      // Build order items data — tidak proses stok karena status PENDING
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
          items: { create: orderItemsToCreate },
        },
      });
    });
  }

  async completeSalesOrder(orderId: string, userId: string) {
    const salesOrder = await this.prisma.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    if (salesOrder.status === 'COMPLETED') {
      throw new BadRequestException(
        `Sales Order ${salesOrder.orderNumber} is already completed`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
      });

      // Konversi OrderItem (dari DB) untuk helper stok
      const itemsForStockOut = salesOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      await this.processStockOut(
        itemsForStockOut,
        updatedOrder.orderNumber,
        userId,
        tx,
      );

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
      take: options?.take ?? 50, // Default limit 50 untuk mencegah query tanpa batas
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

  async getSalesOrderById(id: string) {
    return this.prisma.salesOrder.findUniqueOrThrow({
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
  }

  /**
   * Cancel a PENDING sales order.
   * Only PENDING orders can be cancelled — no stock impact.
   */
  async cancelSalesOrder(orderId: string) {
    const salesOrder = await this.prisma.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
    });

    if (salesOrder.status !== 'PENDING') {
      throw new BadRequestException(
        `Only PENDING orders can be cancelled. Current status: ${salesOrder.status}`,
      );
    }

    return this.prisma.salesOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });
  }
}
