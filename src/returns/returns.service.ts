import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { TransactionType, ReturnStatus, OrderItem, Prisma } from '@prisma/client';

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

  async createReturn(data: CreateReturnDto, userId: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const salesOrder = await prisma.salesOrder.findFirst({
      where: { id: data.salesOrderId },
      include: { items: true },
    });

    if (!salesOrder) {
      throw new NotFoundException(`Sales Order ${data.salesOrderId} not found`);
    }

    if (salesOrder.status !== 'COMPLETED') {
      throw new BadRequestException('Cannot return items from a pending or cancelled order');
    }

    const orderItemsMap = new Map<string, OrderItem>(
      salesOrder.items.map((i: OrderItem) => [i.id, i]),
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

      const remainingReturnable = orderItem.quantity - orderItem.returnedQuantity;
      if (returnItem.quantity > remainingReturnable) {
        throw new BadRequestException(
          `Cannot return ${returnItem.quantity} items for OrderItem ${orderItem.id}. Only ${remainingReturnable} items are returnable.`,
        );
      }

      const unitPrice = orderItem.unitPrice;
      const itemRefundAmount = unitPrice.mul(returnItem.quantity);
      totalRefund = totalRefund.add(itemRefundAmount);

      returnItemsToCreate.push({
        orderItemId: returnItem.orderItemId,
        quantity: returnItem.quantity,
        refundAmount: itemRefundAmount,
        productId: orderItem.productId,
      });
    }

    return this.prisma.$transaction(async (tx: any) => {
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber: data.returnNumber,
          salesOrderId: data.salesOrderId,
          reason: data.reason,
          status: ReturnStatus.COMPLETED,
          totalRefund,
          userId,
          tenantId: salesOrder.tenantId,
          items: {
            create: returnItemsToCreate.map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.quantity,
              refundAmount: item.refundAmount,
            })),
          },
        },
      });

      for (const returnItem of returnItemsToCreate) {
        await tx.orderItem.update({
          where: { id: returnItem.orderItemId },
          data: { returnedQuantity: { increment: returnItem.quantity } },
        });

        await tx.product.update({
          where: { id: returnItem.productId, tenantId },
          data: { stockQuantity: { increment: returnItem.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            type: TransactionType.RETURN,
            quantity: returnItem.quantity,
            referenceId: salesReturn.returnNumber,
            notes: `Return from Sales Order ${salesOrder.orderNumber}`,
            productId: returnItem.productId,
            userId,
            tenantId: salesOrder.tenantId,
          },
        });
      }

      let returnedProfitMargin = new Prisma.Decimal(0);
      let returnedCogs = new Prisma.Decimal(0);
      for (const returnItem of returnItemsToCreate) {
        const orderItem = orderItemsMap.get(returnItem.orderItemId)!;
        const unitPrice = orderItem.unitPrice;

        const unitCogs = orderItem.cogs.div(orderItem.quantity);
        const unitProfitMargin = unitPrice.sub(unitCogs);

        returnedProfitMargin = returnedProfitMargin.add(unitProfitMargin.mul(returnItem.quantity));
        returnedCogs = returnedCogs.add(unitCogs.mul(returnItem.quantity));
      }

      await tx.salesOrder.update({
        where: { id: data.salesOrderId, tenantId },
        data: {
          totalProfit: { decrement: returnedProfitMargin },
          totalCogs: { decrement: returnedCogs },
        },
      });

      return salesReturn;
    });
  }

  async findAll(tenantId: string, skip?: number, take?: number) {
    const prisma = this.prisma.getClient(tenantId);
    const [data, total] = await Promise.all([
      prisma.salesReturn.findMany({
        skip,
        take: take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          salesOrder: { select: { orderNumber: true } },
          user: { select: { username: true } },
        },
      }),
      prisma.salesReturn.count(),
    ]);

    return { data, total };
  }

  async findOne(tenantId: string, id: string) {
    const prisma = this.prisma.getClient(tenantId);
    const result = await prisma.salesReturn.findFirst({
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
    if (!result) {
      throw new NotFoundException(`Sales Return ${id} not found`);
    }
    return result;
  }
}
