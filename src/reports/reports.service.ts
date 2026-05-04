import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { stringify } from 'csv-stringify/sync';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSalesReport(tenantId: string, startDate?: string, endDate?: string) {
    const prisma = this.prisma.getClient(tenantId);
    const where: Prisma.SalesOrderWhereInput = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await prisma.salesOrder.findMany({
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

  async getInventoryReport(tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const products = await prisma.product.findMany({
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

  async getProfitLoss(tenantId: string, startDate?: string, endDate?: string) {
    const prisma = this.prisma.getClient(tenantId);
    const where: Prisma.SalesOrderWhereInput = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await prisma.salesOrder.findMany({
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

  async exportSalesCsv(tenantId: string, startDate?: string, endDate?: string): Promise<string> {
    const prisma = this.prisma.getClient(tenantId);
    const where: Prisma.SalesOrderWhereInput = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      include: {
        items: {
          include: { product: { select: { name: true, sku: true } } },
        },
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    interface CsvRecord {
      'Order Number': string;
      Status: string;
      Product: string;
      SKU: string;
      Quantity: number;
      'Unit Price': number;
      'Total Price': number;
      Profit: number;
      Cashier: string;
      Date: string;
    }

    const records: CsvRecord[] = [];
    for (const order of orders) {
      for (const item of order.items) {
        records.push({
          'Order Number': order.orderNumber,
          Status: order.status,
          Product: item.product.name,
          SKU: item.product.sku,
          Quantity: item.quantity,
          'Unit Price': Number(item.unitPrice),
          'Total Price': Number(order.totalPrice),
          Profit: Number(order.totalProfit),
          Cashier: order.user?.username || '',
          Date: order.createdAt.toISOString(),
        });
      }
    }

    return stringify(records, { header: true });
  }

  async exportInventoryCsv(tenantId: string): Promise<string> {
    const prisma = this.prisma.getClient(tenantId);
    const products = await prisma.product.findMany({
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const records = products.map((p) => ({
      SKU: p.sku,
      'Product Name': p.name,
      Category: p.category?.name || '',
      Supplier: p.supplier?.name || '',
      'Stock Quantity': p.stockQuantity,
      'Reorder Level': p.reorderLevel,
      'Average Cost': Number(p.averageCost),
      Price: Number(p.price),
      'Total Value': Number(p.averageCost) * p.stockQuantity,
      'Needs Reorder': p.stockQuantity <= p.reorderLevel ? 'Yes' : 'No',
    }));

    return stringify(records, { header: true });
  }

  async exportProfitLossCsv(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const prisma = this.prisma.getClient(tenantId);
    const where: Prisma.SalesOrderWhereInput = { status: 'COMPLETED' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      include: {
        user: { select: { username: true } },
        items: {
          include: { product: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const records = orders.map((o) => ({
      'Order Number': o.orderNumber,
      Date: o.createdAt.toISOString(),
      Revenue: Number(o.totalPrice),
      COGS: Number(o.totalCogs),
      Profit: Number(o.totalProfit),
      Cashier: o.user?.username || '',
    }));

    return stringify(records, { header: true });
  }
}
