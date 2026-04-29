import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregated queries
    const [
      totalProducts,
      totalProductsInStock,
      totalSuppliers,
      totalCategories,
      todaySales,
      monthSales,
      totalSalesAmount,
      lowStockProducts,
    ] = await Promise.all([
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null, stockQuantity: { gt: 0 } } }),
      this.prisma.supplier.count({ where: { deletedAt: null } }),
      this.prisma.category.count({ where: { deletedAt: null } }),
      // Today's sales
      this.prisma.salesOrder.aggregate({
        _sum: { totalPrice: true, totalProfit: true },
        where: { createdAt: { gte: startOfToday }, deletedAt: null },
      }),
      // This month's sales
      this.prisma.salesOrder.aggregate({
        _sum: { totalPrice: true, totalProfit: true },
        where: { createdAt: { gte: startOfMonth }, deletedAt: null },
      }),
      // All time total sales revenue
      this.prisma.salesOrder.aggregate({
        _sum: { totalPrice: true },
        where: { deletedAt: null },
      }),
      // Low stock products
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          stockQuantity: { lte: this.prisma.product.fields.reorderLevel },
        },
        select: { id: true, name: true, sku: true, stockQuantity: true, reorderLevel: true },
        orderBy: { stockQuantity: 'asc' },
      }),
    ]);

    return {
      totalProducts,
      totalProductsInStock,
      totalSuppliers,
      totalCategories,
      today: {
        revenue: todaySales._sum.totalPrice ?? new Prisma.Decimal(0),
        profit: todaySales._sum.totalProfit ?? new Prisma.Decimal(0),
      },
      thisMonth: {
        revenue: monthSales._sum.totalPrice ?? new Prisma.Decimal(0),
        profit: monthSales._sum.totalProfit ?? new Prisma.Decimal(0),
      },
      allTimeRevenue: totalSalesAmount._sum.totalPrice ?? new Prisma.Decimal(0),
      lowStockProducts,
    };
  }

  async getTopProducts(limit = 10) {
    // Get top-selling products by total quantity sold from COMPLETED orders
    return this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
      where: {
        order: { status: 'COMPLETED', deletedAt: null },
      },
    });
  }

  async getSalesTrend(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.salesOrder.groupBy({
      by: ['createdAt'],
      _sum: { totalPrice: true, totalProfit: true },
      where: {
        createdAt: { gte: startDate },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getInventoryValue() {
    const result = await this.prisma.product.aggregate({
      _sum: { stockQuantity: true },
      where: { deletedAt: null },
    });

    return {
      totalStockItems: result._sum.stockQuantity ?? 0,
    };
  }
}
