import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(createCategoryDto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: createCategoryDto,
    });
  }

  findAll() {
    return this.prisma.category.findMany({
      where: { deletedAt: null },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id, deletedAt: null },
    });
    if (!category) throw new NotFoundException(`Category #${id} not found`);
    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id); // Check existence
    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Soft delete
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
