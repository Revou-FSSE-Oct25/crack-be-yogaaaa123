#!/bin/bash
# Fix all TypeScript errors in the project

BASE="/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123"

# ============================================================
# 1. Fix DTOs - Add tenantId field
# ============================================================

# Fix create-user.dto.ts - Add tenantId and use TenantRole
cat > "$BASE/src/users/dto/create-user.dto.ts" << 'EOF'
import { IsString, IsEnum, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'johndoe', description: 'The username of the user' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: TenantRole,
    example: TenantRole.STAFF,
    description: 'The role of the user',
  })
  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole;

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;
}
EOF

# Fix update-user.dto.ts - Use TenantRole
cat > "$BASE/src/users/dto/update-user.dto.ts" << 'EOF'
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({
    enum: TenantRole,
    example: TenantRole.ADMIN,
    description: 'New role for the user',
  })
  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole;
}
EOF

# ============================================================
# 2. Fix all controllers - Replace Role with TenantRole
# ============================================================

# Fix activity-log.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/activity-log/activity-log.controller.ts"
sed -i 's/Role.ADMIN/TenantRole.ADMIN/g' "$BASE/src/activity-log/activity-log.controller.ts"

# Fix categories.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/categories/categories.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/categories/categories.controller.ts"

# Fix dashboard.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/dashboard/dashboard.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/dashboard/dashboard.controller.ts"
sed -i 's/Role\.STAFF/TenantRole.STAFF/g' "$BASE/src/dashboard/dashboard.controller.ts"

# Fix inventory.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/inventory/inventory.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/inventory/inventory.controller.ts"

# Fix products.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/products/products.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/products/products.controller.ts"

# Fix purchase.controller.ts
sed -i 's/import { Role, PurchaseOrderStatus } from .prisma.client./import { TenantRole, PurchaseOrderStatus } from .prisma.client./' "$BASE/src/purchase/purchase.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/purchase/purchase.controller.ts"

# Fix reports.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/reports/reports.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/reports/reports.controller.ts"

# Fix returns.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/returns/returns.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/returns/returns.controller.ts"
sed -i 's/Role\.STAFF/TenantRole.STAFF/g' "$BASE/src/returns/returns.controller.ts"

# Fix sales.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/sales/sales.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/sales/sales.controller.ts"

# Fix suppliers.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/suppliers/suppliers.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/suppliers/suppliers.controller.ts"

# Fix upload.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/upload/upload.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/upload/upload.controller.ts"

# Fix users.controller.ts
sed -i 's/import { Role } from .prisma.client./import { TenantRole } from .prisma.client./' "$BASE/src/users/users.controller.ts"
sed -i 's/Role\.ADMIN/TenantRole.ADMIN/g' "$BASE/src/users/users.controller.ts"

# ============================================================
# 3. Fix services - Add tenantId to all create operations
# ============================================================

# Fix categories.service.ts - Add tenantId
cat > "$BASE/src/categories/categories.service.ts" << 'EOF'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(createCategoryDto: CreateCategoryDto, tenantId: string) {
    return this.prisma.category.create({
      data: {
        ...createCategoryDto,
        tenantId,
      },
    });
  }

  async findAll(skip?: number, take?: number) {
    const where = { deletedAt: null };

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: take ?? 50,
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    return this.prisma.category.findUniqueOrThrow({
      where: { id, deletedAt: null },
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id); // Check existence
    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
EOF

# Fix suppliers.service.ts - Add tenantId
cat > "$BASE/src/suppliers/suppliers.service.ts" << 'EOF'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  create(createSupplierDto: CreateSupplierDto, tenantId: string) {
    return this.prisma.supplier.create({
      data: {
        ...createSupplierDto,
        tenantId,
      },
    });
  }

  async findAll(skip?: number, take?: number) {
    const where = { deletedAt: null };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: take ?? 50,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    return this.prisma.supplier.findUniqueOrThrow({
      where: { id, deletedAt: null },
    });
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: updateSupplierDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
EOF

# Fix products.service.ts - Add tenantId
cat > "$BASE/src/products/products.service.ts" << 'EOF'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  create(createProductDto: CreateProductDto, tenantId: string): Promise<Product> {
    return this.prisma.product.create({
      data: {
        ...createProductDto,
        tenantId,
      },
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    search?: string;
    categoryId?: string;
    supplierId?: string;
  }) {
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    // Search by name or SKU
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { sku: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    // Filter by category
    if (options?.categoryId) {
      where.categoryId = options.categoryId;
    }

    // Filter by supplier
    if (options?.supplierId) {
      where.supplierId = options.supplierId;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: options?.skip,
        take: options?.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          supplier: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<Product> {
    return this.prisma.product.findUniqueOrThrow({
      where: { id, deletedAt: null },
      include: {
        category: true,
        supplier: true,
      },
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string): Promise<Product> {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
EOF

# Fix inventory.service.ts - Add tenantId to stockTransaction
cat > "$BASE/src/inventory/inventory.service.ts" << 'EOF'
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType, Prisma } from '@prisma/client';

export interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stockQuantity: number;
  reorderLevel: number;
  supplierName: string | null;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async adjustStock(
    productId: string,
    userId: string,
    tenantId: string,
    quantityChange: number,
    type: TransactionType,
    referenceId?: string,
    notes?: string,
  ) {
    await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    // Determine the operation based on type and quantityChange.
    let operation: 'increment' | 'decrement' = 'increment';
    const absoluteChange = Math.abs(quantityChange);

    if (type === TransactionType.OUT) {
      operation = 'decrement';
    } else if (type === TransactionType.IN) {
      operation = 'increment';
    } else {
      // ADJUSTMENT: if quantityChange is negative, we decrement.
      operation = quantityChange < 0 ? 'decrement' : 'increment';
    }

    return this.prisma.$transaction(async (tx) => {
      // Create stock transaction
      const transaction = await tx.stockTransaction.create({
        data: {
          type,
          quantity: absoluteChange,
          referenceId,
          notes,
          productId,
          userId,
          tenantId,
        },
      });

      // Update product stock quantity
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stockQuantity: {
            [operation]: absoluteChange,
          },
        },
      });

      if (updatedProduct.stockQuantity < 0) {
        throw new BadRequestException(
          `Insufficient stock for product ID ${productId}. Stock cannot be negative.`,
        );
      }

      return { transaction, product: updatedProduct };
    });
  }

  async checkStockAvailability(productId: string, requestedQuantity: number) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stockQuantity: true, name: true },
    });

    if (product.stockQuantity < requestedQuantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${requestedQuantity}`,
      );
    }

    return product;
  }

  async checkReorderLevel(productId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        stockQuantity: true,
        reorderLevel: true,
        name: true,
        sku: true,
      },
    });

    return {
      ...product,
      isBelowReorderLevel: product.stockQuantity <= product.reorderLevel,
    };
  }

  /**
   * Get all products where stockQuantity <= reorderLevel.
   * Uses raw SQL because Prisma ORM doesn't support column-to-column comparison.
   */
  async getLowStockProducts(): Promise<LowStockProduct[]> {
    return this.prisma.$queryRaw<LowStockProduct[]>(
      Prisma.sql`
        SELECT
          p.id,
          p.sku,
          p.name,
          p."stockQuantity",
          p."reorderLevel",
          s.name AS "supplierName"
        FROM products p
        LEFT JOIN suppliers s ON p."supplierId" = s.id
        WHERE p."stockQuantity" <= p."reorderLevel"
          AND p."deletedAt" IS NULL
        ORDER BY p."stockQuantity" ASC
      `,
    );
  }
}
EOF

# Fix inventory.controller.ts - Add tenantId
cat > "$BASE/src/inventory/inventory.controller.ts" << 'EOF'
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjust')
  @Roles(TenantRole.ADMIN)
  @ApiOperation({
    summary: 'Adjust stok manual (Admin only)',
    description: `
Adjust stok produk secara manual. Biasanya untuk koreksi stok.

**Aturan:**
- quantityChange POSITIVE → nambah stok
- quantityChange NEGATIVE → ngurangin stok
- quantityChange TIDAK BOLEH 0!
- type: pilih jenis transaksi (ADJUSTMENT, DAMAGED, LOST, FOUND, MANUAL)

**Akses:** ADMIN ONLY
    `,
  })
  @ApiBody({ type: AdjustStockDto })
  @ApiResponse({ status: 201, description: 'Stok berhasil diadjust' })
  @ApiResponse({ status: 400, description: 'Bad Request — stok tidak cukup untuk pengurangan' })
  adjustStock(@Body() adjustStockDto: AdjustStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.adjustStock(
      adjustStockDto.productId,
      user.id,
      user.tenantId,
      adjustStockDto.quantityChange,
      adjustStockDto.type,
      adjustStockDto.referenceId,
      adjustStockDto.notes,
    );
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'Produk dengan stok menipis (below reorder level)',
    description: `
Mendapatkan daftar produk yang stoknya sudah di bawah reorder level.
Berguna untuk restock alert di dashboard.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar produk low stock',
    schema: {
      example: [
        { id: 'uuid', name: 'iPhone 15', sku: 'SKU-1001', stockQuantity: 3, reorderLevel: 10 },
      ],
    },
  })
  getLowStockProducts() {
    return this.inventoryService.getLowStockProducts();
  }

  @Get('check-reorder/:productId')
  @ApiOperation({
    summary: 'Cek apakah produk tertentu perlu re-order',
    description: 'Mengecek stok produk vs reorder level. Return status dan saran quantity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status reorder produk',
    schema: {
      example: {
        productName: 'iPhone 15',
        currentStock: 3,
        reorderLevel: 10,
        needsReorder: true,
        suggestedOrderQty: 7,
      },
    },
  })
  checkReorderLevel(@Param('productId') productId: string) {
    return this.inventoryService.checkReorderLevel(productId);
  }
}
EOF

# Fix sales.service.ts - Add tenantId to all creates
cat > "$BASE/src/sales/sales.service.ts" << 'EOF'
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TransactionType, SalesOrderStatus, Prisma } from '@prisma/client';
import type { CreateSalesOrderDto as CreateSalesOrderDtoBase } from './dto/create-sales-order.dto';

// Extend DTO with server-side userId (injected by controller from JWT)
interface CreateSalesOrderData extends CreateSalesOrderDtoBase {
  userId: string;
  tenantId: string;
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
  cogs: Prisma.Decimal; // total COGS for this item (unitCost * quantity)
  profitMargin: Prisma.Decimal; // total profit for this item ((unitPrice - unitCost) * quantity)
}

// Aggregated result from buildOrderItemsData
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
   * Private helper: calculate COGS, profit, and prepare order items data.
   * Extracted to eliminate duplication between createSalesOrder & createPendingSalesOrder.
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
      // cogs = unitCost * quantity (TOTAL cost for all quantity of this item)
      const itemCogs = unitCost.mul(item.quantity);
      // profitMargin = (unitPrice - unitCost) * quantity (TOTAL profit for this item)
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
   * Private helper: decrement stock and create StockTransaction OUT for each item.
   * Uses pessimistic check within the transaction for race condition safety.
   */
  private async processStockOut(
    items: { productId: string; quantity: number }[],
    orderNumber: string,
    userId: string,
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const item of items) {
      const updatedProduct = await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
        select: { stockQuantity: true, reorderLevel: true, name: true },
      });

      // Pessimistic check: If stock becomes negative, rollback the transaction
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
          referenceId: orderNumber,
          notes: 'Sales Order Completed',
          productId: item.productId,
          userId,
          tenantId,
        },
      });

      // Log warning ONLY if stock just dropped below reorder level
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
      // Build order items data (COGS, profit, price) — pre-check stock omitted,
      // pessimistic check in processStockOut is sufficient and more atomic
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
          tenantId: data.tenantId,
          items: { create: orderItemsToCreate },
        },
      });

      // Decrement stock and create stock transactions
      await this.processStockOut(data.items, salesOrder.orderNumber, data.userId, data.tenantId, tx);

      return salesOrder;
    });
  }

  async createPendingSalesOrder(data: CreateSalesOrderData) {
    return this.prisma.$transaction(async (tx) => {
      // Build order items data — no stock processing since status is PENDING
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
          tenantId: data.tenantId,
          items: { create: orderItemsToCreate },
        },
      });
    });
  }

  async completeSalesOrder(orderId: string, userId: string, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Atomic status check + update — prevents race conditions from concurrent requests.
      const salesOrder = await tx.salesOrder.findFirst({
        where: { id: orderId, status: 'PENDING' },
        include: { items: true },
      });

      if (!salesOrder) {
        // Check if it exists at all for a more descriptive error
        const exists = await tx.salesOrder.findUnique({
          where: { id: orderId },
        });
        if (!exists) {
          throw new BadRequestException(`Sales Order ${orderId} not found`);
        }
        throw new BadRequestException(
          `Only PENDING orders can be completed. Current status: ${exists.status}`,
        );
      }

      const updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
      });

      // Convert OrderItem (from DB) for stock helper
      const itemsForStockOut = salesOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      await this.processStockOut(itemsForStockOut, updatedOrder.orderNumber, userId, tenantId, tx);

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
      deletedAt: null,
      ...(options?.customerId && { customerId: options.customerId }),
      ...(options?.status && { status: options.status }),
    };

    return this.prisma.salesOrder.findMany({
      where,
      skip: options?.skip,
      take: options?.take ?? 50, // Default limit 50 to prevent unbounded queries
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
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
    // Atomic check-and-set: only update if status is still PENDING
    const result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.salesOrder.updateMany({
        where: {
          id: orderId,
          status: 'PENDING', // ← Atomic condition: only PENDING orders
        },
        data: { status: 'CANCELLED' },
      });

      if (updateResult.count === 0) {
        // updateMany didn't update anything — check why
        const exists = await tx.salesOrder.findUnique({
          where: { id: orderId },
          select: { id: true, status: true },
        });

        if (!exists) {
          throw new NotFoundException(`Sales Order ${orderId} not found`);
        }

        throw new BadRequestException(
          `Only PENDING orders can be cancelled. Current status: ${exists.status}`,
        );
      }

      // Fetch and return the updated order for the response
      return tx.salesOrder.findUniqueOrThrow({
        where: { id: orderId },
      });
    });

    return result;
  }
}
EOF

# Fix sales.controller.ts - Pass tenantId
cat > "$BASE/src/sales/sales.controller.ts" << 'EOF'
import { Controller, Get, Post, Body, Param, UseGuards, Query, Patch } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRole } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto, SalesOrderItemDto } from './dto/create-sales-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { SalesOrderStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({
    summary: 'Buat transaksi penjualan langsung (COMPLETED — langsung kurangi stok)',
    description: `
Membuat sales order dengan status COMPLETED.

**Proses:**
1. Validasi semua produk tersedia & stok cukup
2. Cek stok secara PESSIMISTIC (row-level lock via Prisma \$transaction)
3. Kurangi stok setiap produk
4. Catat transaksi inventory
5. Hitung otomatis: totalPrice, totalCogs, totalProfit

**Akses:** STAFF dan ADMIN
    `,
  })
  @ApiBody({ type: CreateSalesOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Sales order berhasil dibuat',
    schema: {
      example: {
        id: 'uuid-sales-1',
        orderNumber: 'SO-1001',
        status: 'COMPLETED',
        totalPrice: 1999.98,
        totalProfit: 399.98,
        items: [{ productId: 'uuid-prod-1', quantity: 2, unitPrice: 999.99 }],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request — stok tidak cukup atau data tidak valid' })
  createSalesOrder(@Body() createDto: CreateSalesOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.createSalesOrder({
      ...createDto,
      userId: user.id,
      tenantId: user.tenantId,
    });
  }

  @Post('pending')
  @ApiOperation({
    summary: 'Buat transaksi penjualan PENDING (tidak kurangi stok)',
    description: `
Membuat sales order dengan status PENDING.

**Kapan pakai ini?**
- Order via kasir yang akan dibayar nanti
- Pre-order / order khusus
- Tidak langsung mengurangi stok sampai dikonfirmasi via PATCH /:id/complete

**Akses:** STAFF dan ADMIN
    `,
  })
  @ApiBody({ type: CreateSalesOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Pending sales order berhasil dibuat',
    schema: { example: { id: 'uuid-sales-2', orderNumber: 'SO-1002', status: 'PENDING' } },
  })
  createPendingSalesOrder(
    @Body() createDto: CreateSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.createPendingSalesOrder({
      ...createDto,
      userId: user.id,
      tenantId: user.tenantId,
    });
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Konfirmasi / complete pending sales order (langsung kurangi stok)',
    description: `
Mengubah status PENDING → COMPLETED.

**Proses:**
1. Validasi order ada & statusnya PENDING
2. Cek stok cukup (pessimistic lock)
3. Kurangi stok setiap produk
4. Catat transaksi inventory

**Akses:** STAFF dan ADMIN (siapa saja yang terautentikasi)
    `,
  })
  @ApiResponse({ status: 200, description: 'Sales order berhasil di-complete' })
  @ApiResponse({ status: 404, description: 'Sales order tidak ditemukan' })
  @ApiResponse({ status: 400, description: 'Stok tidak cukup atau order sudah COMPLETED' })
  completeSalesOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.completeSalesOrder(id, user.id, user.tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Ambil semua sales orders (dengan filter)',
    description: `
Mendapatkan daftar sales order dengan berbagai filter