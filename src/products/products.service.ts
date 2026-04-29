import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  create(createProductDto: CreateProductDto): Promise<Product> {
    return this.prisma.product.create({
      data: createProductDto,
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
