import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findAll(tenantId: string, skip?: number, take?: number) {
    const prisma = this.prisma.getClient(tenantId);
    const where = { deletedAt: null };

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: take ?? 50,
        orderBy: { name: 'asc' },
      }),
      prisma.category.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const category = await prisma.category.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    await this.findOne(id, tenantId);
    return prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(id: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    await this.findOne(id, tenantId);
    // Soft delete
    return prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
