import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findAll(tenantId: string, skip?: number, take?: number) {
    const prisma = this.prisma.getClient(tenantId);
    const where = {};

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: take ?? 50,
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const supplier = await prisma.supplier.findFirst({
      where: { id },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    await this.findOne(id, tenantId);
    return prisma.supplier.update({
      where: { id },
      data: updateSupplierDto,
    });
  }

  async remove(id: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    await this.findOne(id, tenantId);
    return prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
