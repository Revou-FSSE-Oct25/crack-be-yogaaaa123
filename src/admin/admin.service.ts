import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  async findAllTenants(skip?: number, take?: number) {
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: {
            select: {
              users: { where: { deletedAt: null } },
              products: { where: { deletedAt: null } },
              salesOrders: true,
              purchaseOrders: true,
            },
          },
        },
        skip,
        take: take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        createdAt: t.createdAt,
        stats: {
          totalUsers: t._count.users,
          totalProducts: t._count.products,
          totalSalesOrders: t._count.salesOrders,
          totalPurchaseOrders: t._count.purchaseOrders,
        },
      })),
      total,
      skip: skip ?? 0,
      take: take ?? 50,
    };
  }

  async findTenantById(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            products: { where: { deletedAt: null } },
            categories: { where: { deletedAt: null } },
            suppliers: { where: { deletedAt: null } },
            salesOrders: true,
            purchaseOrders: true,
            returns: true,
            stockTransactions: true,
          },
        },
        members: {
          select: {
            role: true,
            platformUser: {
              select: { email: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      stats: {
        totalUsers: tenant._count.users,
        totalProducts: tenant._count.products,
        totalCategories: tenant._count.categories,
        totalSuppliers: tenant._count.suppliers,
        totalSalesOrders: tenant._count.salesOrders,
        totalPurchaseOrders: tenant._count.purchaseOrders,
        totalReturns: tenant._count.returns,
        totalStockTransactions: tenant._count.stockTransactions,
      },
      owners: tenant.members
        .filter((m) => m.role === 'OWNER')
        .map((m) => ({
          email: m.platformUser.email,
          name: m.platformUser.name,
        })),
    };
  }

  async removeTenant(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan');
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.tenantUser.updateMany({ where: { tenantId: id }, data: { deletedAt: now } });
      await tx.product.updateMany({ where: { tenantId: id }, data: { deletedAt: now } });
      await tx.category.updateMany({ where: { tenantId: id }, data: { deletedAt: now } });
      await tx.supplier.updateMany({ where: { tenantId: id }, data: { deletedAt: now } });
      await tx.salesOrder.updateMany({ where: { tenantId: id }, data: { deletedAt: now } });
      await tx.purchaseOrder.updateMany({ where: { tenantId: id }, data: { deletedAt: now } });
      await tx.tenant.update({ where: { id }, data: { deletedAt: now } });
    });

    this.logger.log(`Tenant ${tenant.name} (${id}) has been soft-deleted`);
    return { message: 'Tenant berhasil dihapus', id, name: tenant.name };
  }

  async getPlatformStats() {
    const [
      totalTenants,
      totalUsers,
      totalProducts,
      totalSalesOrders,
      totalPurchaseOrders,
      totalReturns,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenantUser.count({ where: { deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.salesOrder.count(),
      this.prisma.purchaseOrder.count(),
      this.prisma.salesReturn.count(),
    ]);

    return {
      platform: {
        totalTenants,
        totalUsers,
        totalProducts,
        totalSalesOrders,
        totalPurchaseOrders,
        totalReturns,
      },
    };
  }

  async login(email: string, password: string) {
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { email, deletedAt: null },
    });

    if (!admin) {
      throw new NotFoundException('Admin tidak ditemukan');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new NotFoundException('Email atau password salah');
    }

    this.logger.log(`Super admin ${admin.email} logged in`);
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    };
  }
}
