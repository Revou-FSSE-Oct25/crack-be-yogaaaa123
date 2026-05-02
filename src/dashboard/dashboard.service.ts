import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
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
      prisma.product.count(),
      prisma.product.count({ where: { stockQuantity: { gt: 0 } } }),
      prisma.supplier.count(),
      prisma.category.count(),
      // Today's sales
      prisma.salesOrder.aggregate({
        _sum: { totalPrice: true, totalProfit: true },
        where: { createdAt: { gte: startOfToday } },
      }),
      // This month's sales
      prisma.salesOrder.aggregate({
        _sum: { totalPrice: true, totalProfit: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      // All time total sales revenue
      prisma.salesOrder.aggregate({
        _sum: { totalPrice: true },
      }),
      // Low stock products — use raw query because Prisma ORM doesn't support column-to-column comparison
      prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string;
          stockQuantity: number;
          reorderLevel: number;
        }>
      >(
        Prisma.sql`
          SELECT id, name, sku, "stockQuantity", "reorderLevel"
          FROM products
          WHERE "tenantId" = ${tenantId}
            AND "stockQuantity" <= "reorderLevel"
            AND "deletedAt" IS NULL
          ORDER BY "stockQuantity" ASC
        `,
      ),
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

  async getTopProducts(tenantId: string, limit = 10) {
    const prisma = this.prisma.getClient(tenantId);
    // Get top-selling products by total quantity sold from COMPLETED orders
    return prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
      where: {
        order: { status: 'COMPLETED' },
      },
    });
  }

  /**
   * Get sales trend over the last N days, grouped by day.
   *
   * BUG FIX (getSalesTrend):
   * Previously used Prisma's groupBy on 'createdAt', which groups by the FULL
   * timestamp (including hours/minutes/seconds). This meant every order got its
   * own group since timestamps are unique. The result was a flat list of orders
   * instead of daily aggregates.
   *
   * Now uses $queryRaw with PostgreSQL's DATE_TRUNC to group by day:
   *   SELECT DATE_TRUNC('day', "createdAt") AS date, ...
   *   GROUP BY DATE_TRUNC('day', "createdAt")
   *   ORDER BY date ASC
   *
   * This correctly aggregates revenue/profit per day.
   */
  async getSalesTrend(tenantId: string, days = 30) {
    const prisma = this.prisma.getClient(tenantId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Use raw SQL with DATE_TRUNC to properly group sales by day
    // PostgreSQL's DATE_TRUNC('day', timestamp) rounds down to midnight
    const result = await prisma.$queryRaw<
      Array<{
        date: Date;
        revenue: Prisma.Decimal;
        profit: Prisma.Decimal;
        order_count: bigint;
      }>
    >`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        COALESCE(SUM("totalPrice"), 0) AS revenue,
        COALESCE(SUM("totalProfit"), 0) AS profit,
        COUNT(*)::bigint AS order_count
      FROM sales_orders
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${startDate}
        AND "deletedAt" IS NULL
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return result.map((row) => ({
      date: row.date,
      revenue: row.revenue,
      profit: row.profit,
      order_count: Number(row.order_count),
    }));
  }

  async getInventoryValue(tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const result = await prisma.product.aggregate({
      _sum: { stockQuantity: true },
    });

    return {
      totalStockItems: result._sum.stockQuantity ?? 0,
    };
  }
}
