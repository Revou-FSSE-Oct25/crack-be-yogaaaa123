import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, tenantId: string): Promise<Product> {
    const prisma = this.prisma.getClient(tenantId);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.plan === 'free') {
      const productCount = await prisma.product.count({ where: { tenantId } });
      if (productCount >= 50) {
        throw new ForbiddenException(
          'Limit 50 produk tercapai untuk paket Free. Silakan upgrade ke Pro atau Ultra.',
        );
      }
    }

    return prisma.product.create({
      data: {
        ...createProductDto,
        tenantId,
      },
    });
  }

  async findAll(
    tenantId: string,
    options?: {
      skip?: number;
      take?: number;
      search?: string;
      categoryId?: string;
      supplierId?: string;
    },
  ) {
    const prisma = this.prisma.getClient(tenantId);
    const where: Prisma.ProductWhereInput = {};

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { sku: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options?.supplierId) {
      where.supplierId = options.supplierId;
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: options?.skip,
        take: options?.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          supplier: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, tenantId: string): Promise<Product | null> {
    const prisma = this.prisma.getClient(tenantId);
    const product = await prisma.product.findFirst({
      where: { id },
      include: {
        category: true,
        supplier: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto, tenantId: string): Promise<Product> {
    const prisma = this.prisma.getClient(tenantId);
    await this.findOne(id, tenantId);
    return prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string, tenantId: string): Promise<Product> {
    const prisma = this.prisma.getClient(tenantId);
    await this.findOne(id, tenantId);
    return prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
