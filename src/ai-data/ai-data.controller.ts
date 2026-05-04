import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

/**
 * AiDataController — Read-only data endpoints for the Python AI service.
 *
 * ARCHITECTURE RATIONALE:
 * Instead of the Python AI service connecting directly to PostgreSQL (bypassing
 * NestJS business logic), we expose these read-only endpoints. The Python AI
 * service calls these endpoints via HTTP using the internal API key.
 *
 * SECURITY:
 * - All endpoints are GET-only (read-only, no mutations)
 * - Protected by X-Internal-API-Key header
 * - User context (userId, role, tenantId) comes as query params (Python reads from JWT)
 * - tenantId is validated against the user's actual tenant membership
 * - Rate limited by NestJS throttler
 *
 * TENANT ISOLATION (Fix #5):
 * - The `tenantId` query param is REQUIRED for all endpoints
 * - Backend validates that the user actually belongs to the requested tenant
 * - All queries use the tenant-aware Prisma client (`getClient(tenantId)`)
 * - This prevents data leakage even if the internal API key is compromised
 *
 * This solves: Direct DB access by Python (issue #1), Code Duplication (issue #9),
 *              Tenant data leakage (issue #5)
 */
@ApiTags('ai-data')
@ApiBearerAuth()
@Controller('ai-data')
export class AiDataController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Internal auth check — validates X-Internal-API-Key from Python AI service.
   */
  private validateInternalKey(key: string | undefined): void {
    const expected = process.env.AI_INTERNAL_API_KEY;
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }

  /**
   * Validate that the user belongs to the specified tenant.
   * This prevents the AI service from accessing data from other tenants
   * even if the internal API key is compromised.
   *
   * @throws ForbiddenException if the user does not belong to the tenant
   */
  private async validateTenantAccess(userId: string, tenantId: string): Promise<void> {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: {
        id: userId,
        tenantId: tenantId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!tenantUser) {
      throw new ForbiddenException('Access denied: User does not belong to the requested tenant');
    }
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get dashboard KPI summary (for AI)' })
  @ApiHeader({
    name: 'X-Internal-API-Key',
    required: true,
    description: 'Internal API key for Python AI service',
  })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  async getDashboardSummary(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') _role: string,
    @Query('tenantId') tenantId: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    const prisma = this.prisma.getClient(tenantId);

    try {
      const totalProducts = await prisma.product.count();
      // Use raw query for stock <= reorderLevel comparison
      const lowStockResult: Array<{ count: bigint }> = await prisma.$queryRaw(
        Prisma.sql`SELECT COUNT(*) as count FROM products WHERE "tenantId" = ${tenantId} AND "stockQuantity" <= "reorderLevel" AND "deletedAt" IS NULL`,
      );
      const lowStockCount = Number(lowStockResult[0]?.count || 0);

      // Today's sales
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todaySales = await prisma.salesOrder.aggregate({
        _sum: { totalPrice: true },
        _count: true,
        where: { createdAt: { gte: todayStart } },
      });

      // This month's sales
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthSales = await prisma.salesOrder.aggregate({
        _sum: { totalPrice: true },
        where: { createdAt: { gte: monthStart } },
      });

      return {
        total_products: totalProducts,
        today_sales_amount: Number(todaySales._sum?.totalPrice || 0),
        today_sales_count: todaySales._count,
        month_sales_amount: Number(monthSales._sum?.totalPrice || 0),
        low_stock_count: lowStockCount,
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // LOW STOCK PRODUCTS
  // ═════════════════════════════════════════════════════════════════════

  @Get('products/low-stock')
  @ApiOperation({ summary: 'Get products with low stock (for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  @ApiQuery({ name: 'limit', required: false })
  async getLowStockProducts(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') _role: string,
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    const prisma = this.prisma.getClient(tenantId);
    const take = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 50);

    try {
      // Use raw query for stock <= reorderLevel comparison
      const products: Array<{
        id: string;
        name: string;
        sku: string;
        stockQuantity: number;
        reorderLevel: number;
        price: string;
      }> = await prisma.$queryRaw(
        Prisma.sql`SELECT id, name, sku, "stockQuantity", "reorderLevel", price
         FROM products
         WHERE "tenantId" = ${tenantId} AND "stockQuantity" <= "reorderLevel" AND "deletedAt" IS NULL
         ORDER BY "stockQuantity" ASC
         LIMIT ${take}`,
      );

      return {
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: Number(p.stockQuantity),
          reorder_point: Number(p.reorderLevel),
          price: parseFloat(p.price),
        })),
        total: products.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // TOP PRODUCTS (by order item count)
  // ═════════════════════════════════════════════════════════════════════

  @Get('products/top')
  @ApiOperation({ summary: 'Get top selling products (for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  @ApiQuery({ name: 'limit', required: false })
  async getTopProducts(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') _role: string,
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    const prisma = this.prisma.getClient(tenantId);
    const take = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);

    try {
      // Group by product and sum quantities from order items
      const topProducts: Array<{ productId: string; total_qty: bigint }> = await prisma.$queryRaw(
        Prisma.sql`SELECT oi."productId", SUM(oi.quantity) as total_qty
           FROM order_items oi
           JOIN sales_orders so ON so.id = oi."orderId" AND so."tenantId" = ${tenantId} AND so."deletedAt" IS NULL
           GROUP BY oi."productId"
           ORDER BY total_qty DESC
           LIMIT ${take}`,
      );

      if (topProducts.length === 0) {
        return { products: [] };
      }

      const productIds = topProducts.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          price: true,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      return {
        products: topProducts.map((tp) => {
          const p = productMap.get(tp.productId);
          return {
            id: tp.productId,
            name: p?.name || 'Unknown',
            sku: p?.sku || '',
            stock: p?.stockQuantity || 0,
            sold: Number(tp.total_qty),
            price: p ? Number(p.price) : 0,
          };
        }),
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // SEARCH PRODUCTS
  // ═════════════════════════════════════════════════════════════════════

  @Get('products/search')
  @ApiOperation({ summary: 'Search products by name/SKU (for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async searchProducts(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') _role: string,
    @Query('tenantId') tenantId: string,
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    const prisma = this.prisma.getClient(tenantId);

    if (!query || query.trim().length === 0) {
      return { products: [], total: 0 };
    }
    if (query.trim().length > 100) {
      return { products: [], total: 0, error: 'Search query too long (max 100 chars)' };
    }

    const take = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
    const searchTerm = query.trim();

    try {
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take,
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          price: true,
          category: { select: { name: true } },
        },
      });

      return {
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stockQuantity,
          price: Number(p.price),
          category: p.category?.name || null,
        })),
        total: products.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // SALES REPORT
  // ═════════════════════════════════════════════════════════════════════

  @Get('sales/report')
  @ApiOperation({ summary: 'Get sales report (for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getSalesReport(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') role: string,
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    const prisma = this.prisma.getClient(tenantId);
    const take = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 50);

    try {
      const whereSalesReport: Prisma.SalesOrderWhereInput = {};
      if (startDate) {
        whereSalesReport.createdAt = { gte: new Date(startDate) };
      }
      if (endDate) {
        whereSalesReport.createdAt = {
          ...((whereSalesReport.createdAt as object) || {}),
          lte: new Date(endDate),
        };
      }

      // Staff only sees their own orders
      if (role === 'STAFF') {
        whereSalesReport.userId = userId;
      }

      const [orders, aggregate] = await Promise.all([
        prisma.salesOrder.findMany({
          where: whereSalesReport,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            totalPrice: true,
            createdAt: true,
            user: { select: { username: true } },
          },
        }),
        prisma.salesOrder.aggregate({
          where: whereSalesReport,
          _sum: { totalPrice: true },
          _count: true,
        }),
      ]);

      return {
        total_orders: aggregate._count,
        total_revenue: Number(aggregate._sum?.totalPrice || 0),
        orders: orders.map((o) => ({
          id: o.id,
          order_number: o.orderNumber,
          total: Number(o.totalPrice),
          cashier: o.user?.username || 'unknown',
          date: o.createdAt,
        })),
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // PROFIT & LOSS
  // ═════════════════════════════════════════════════════════════════════

  @Get('sales/profit-loss')
  @ApiOperation({ summary: 'Get profit & loss report (for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getProfitLoss(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') role: string,
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    if (role !== 'ADMIN') {
      return { error: 'Access denied. ADMIN role required.' };
    }
    const prisma = this.prisma.getClient(tenantId);

    try {
      const whereProfitLoss: Prisma.SalesOrderWhereInput = {};
      if (startDate) {
        whereProfitLoss.createdAt = { gte: new Date(startDate) };
      }
      if (endDate) {
        whereProfitLoss.createdAt = {
          ...((whereProfitLoss.createdAt as object) || {}),
          lte: new Date(endDate),
        };
      }

      const aggregate = await prisma.salesOrder.aggregate({
        where: whereProfitLoss,
        _sum: { totalPrice: true, totalCogs: true, totalProfit: true },
        _count: true,
      });

      const revenue = Number(aggregate._sum?.totalPrice || 0);
      const cogs = Number(aggregate._sum?.totalCogs || 0);
      const profit = Number(aggregate._sum?.totalProfit || 0);
      const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';

      return {
        total_orders: aggregate._count,
        total_revenue: revenue,
        total_cogs: cogs,
        net_profit: profit,
        profit_margin: `${margin}%`,
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═════════════════════════════════════════════════════════════════════

  @Get('categories')
  @ApiOperation({ summary: 'Get product categories with counts (for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  async getCategories(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') _role: string,
    @Query('tenantId') tenantId: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    const prisma = this.prisma.getClient(tenantId);

    try {
      const categories = await prisma.category.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });

      return {
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          product_count: c._count.products,
        })),
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // SUPPLIERS
  // ═════════════════════════════════════════════════════════════════════

  @Get('suppliers')
  @ApiOperation({ summary: 'Get suppliers (for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  async getSuppliers(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') _role: string,
    @Query('tenantId') tenantId: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    const prisma = this.prisma.getClient(tenantId);

    try {
      const suppliers = await prisma.supplier.findMany({
        select: {
          id: true,
          name: true,
          contactName: true,
          phone: true,
          email: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });

      return {
        suppliers: suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          contact_person: s.contactName,
          phone: s.phone,
          email: s.email,
          product_count: s._count.products,
        })),
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // USERS (ADMIN only)
  // ═════════════════════════════════════════════════════════════════════

  @Get('users')
  @ApiOperation({ summary: 'Get users list (ADMIN only, for AI)' })
  @ApiHeader({ name: 'X-Internal-API-Key', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Tenant ID for data isolation' })
  async getUsers(
    @Headers('x-internal-api-key') apiKey: string,
    @Query('userId') userId: string,
    @Query('role') role: string,
    @Query('tenantId') tenantId: string,
  ) {
    this.validateInternalKey(apiKey);
    await this.validateTenantAccess(userId, tenantId);
    if (role !== 'ADMIN') {
      return { error: 'Access denied. ADMIN role required.' };
    }
    const prisma = this.prisma.getClient(tenantId);

    try {
      const users = await prisma.tenantUser.findMany({
        select: {
          id: true,
          username: true,
          role: true,
        },
        orderBy: { username: 'asc' },
      });

      return {
        users: users.map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role,
        })),
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new InternalServerErrorException(err.message);
    }
  }
}
