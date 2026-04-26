import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import {
  TransactionType,
  ReturnStatus,
  OrderItem,
  Prisma,
} from '@prisma/client';

interface ReturnItemToCreate {
  orderItemId: string;
  quantity: number;
  refundAmount: Prisma.Decimal;
  productId: string;
}

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReturn(data: CreateReturnDto, userId: string) {
    // 1. Fetch Sales Order and its items
    const salesOrder = await this.prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      include: { items: true },
    });

    if (!salesOrder) {
      throw new NotFoundException(`Sales Order ${data.salesOrderId} not found`);
    }

    if (salesOrder.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Cannot return items from a pending or cancelled order',
      );
    }

    // 2. Validate return items
    const orderItemsMap = new Map<string, OrderItem>(
      salesOrder.items.map((i) => [i.id, i]),
    );
    let totalRefund = new Prisma.Decimal(0);
    const returnItemsToCreate: ReturnItemToCreate[] = [];

    for (const returnItem of data.items) {
      const orderItem = orderItemsMap.get(returnItem.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `Order Item ${returnItem.orderItemId} does not belong to this Sales Order`,
        );
      }

      // Check if quantity to return is valid
      const remainingReturnable =
        orderItem.quantity - orderItem.returnedQuantity;
      if (returnItem.quantity > remainingReturnable) {
        throw new BadRequestException(
          `Cannot return ${returnItem.quantity} items for OrderItem ${orderItem.id}. Only ${remainingReturnable} items are returnable.`,
        );
      }

      // Use Decimal arithmetic for refund amount — no floating-point error
      const unitPrice = orderItem.unitPrice; // Already Prisma.Decimal from DB
      const itemRefundAmount = unitPrice.mul(returnItem.quantity);
      totalRefund = totalRefund.add(itemRefundAmount);

      returnItemsToCreate.push({
        orderItemId: returnItem.orderItemId,
        quantity: returnItem.quantity,
        refundAmount: itemRefundAmount,
        productId: orderItem.productId,
      });
    }

    // 3. Execute Transaction
    return this.prisma.$transaction(async (tx) => {
      // Create Sales Return
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber: data.returnNumber,
          salesOrderId: data.salesOrderId,
          reason: data.reason,
          status: ReturnStatus.COMPLETED,
          totalRefund,
          userId,
          items: {
            create: returnItemsToCreate.map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.quantity,
              refundAmount: item.refundAmount,
            })),
          },
        },
      });

      // Process each returned item: update stock, create transaction, update returnedQuantity
      for (const returnItem of returnItemsToCreate) {
        // Increment returnedQuantity on OrderItem
        await tx.orderItem.update({
          where: { id: returnItem.orderItemId },
          data: { returnedQuantity: { increment: returnItem.quantity } },
        });

        // Add stock back to product
        await tx.product.update({
          where: { id: returnItem.productId },
          data: { stockQuantity: { increment: returnItem.quantity } },
        });

        // Create RETURN stock transaction
        await tx.stockTransaction.create({
          data: {
            type: TransactionType.RETURN,
            quantity: returnItem.quantity,
            referenceId: salesReturn.returnNumber,
            notes: `Return from Sales Order ${salesOrder.orderNumber}`,
            productId: returnItem.productId,
            userId,
          },
        });
      }

      // Update Sales Order financials to reflect the return using Decimal arithmetic
      let returnedProfitMargin = new Prisma.Decimal(0);
      let returnedCogs = new Prisma.Decimal(0);
      for (const returnItem of returnItemsToCreate) {
        const orderItem = orderItemsMap.get(returnItem.orderItemId)!;
        const unitPrice = orderItem.unitPrice; // Prisma.Decimal (per unit)

        // FIX: orderItem.cogs is the TOTAL cogs for the entire original quantity,
        // so we must divide by original quantity to get per-unit cost.
        const unitCogs = orderItem.cogs.div(orderItem.quantity); // per-unit cost
        const unitProfitMargin = unitPrice.sub(unitCogs); // per-unit profit

        returnedProfitMargin = returnedProfitMargin.add(
          unitProfitMargin.mul(returnItem.quantity),
        );
        returnedCogs = returnedCogs.add(unitCogs.mul(returnItem.quantity));
      }

      await tx.salesOrder.update({
        where: { id: data.salesOrderId },
        data: {
          totalProfit: { decrement: returnedProfitMargin },
          totalCogs: { decrement: returnedCogs },
        },
      });

      return salesReturn;
    });
  }

  findAll() {
    return this.prisma.salesReturn.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        salesOrder: { select: { orderNumber: true } },
        user: { select: { username: true } },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.salesReturn.findUniqueOrThrow({
      where: { id },
      include: {
        items: {
          include: {
            orderItem: {
              include: { product: true },
            },
          },
        },
        salesOrder: true,
        user: true,
      },
    });
  }
}
