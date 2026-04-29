import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesReport(startDate?: string, endDate?: string) {
    const where: any = { deletedAt: null };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await this.prisma.salesOrder.findMany({
      where,
      include: {
        items: {
          include: { product: { select: { name: true, sku: true } } },
        },
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.totalPrice), 0),
      totalProfit: orders.reduce((sum, o) => sum + Number(o.totalProfit), 0),
    };

    return { summary, orders };
  }

  async getInventoryReport() {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const summary = {
      totalProducts: products.length,
      totalStock: products.reduce((sum, p) => sum + p.stockQuantity, 0),
      lowStock: products.filter((p) => p.stockQuantity <= p.reorderLevel).length,
    };

    return { summary, products };
  }

  async getProfitLoss(startDate?: string, endDate?: string) {
    const where: any = { deletedAt: null };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await this.prisma.salesOrder.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
      },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const totalCogs = orders.reduce((sum, o) => sum + Number(o.totalCogs), 0);
    const totalProfit = orders.reduce((sum, o) => sum + Number(o.totalProfit), 0);
    const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

    return {
      period: { startDate, endDate },
      totalOrders: orders.length,
      totalRevenue,
      totalCogs,
      totalProfit,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      averageOrderValue,
    };
  }
}
