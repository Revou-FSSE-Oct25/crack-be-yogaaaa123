import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityAction, Prisma } from '@prisma/client';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    userId: string;
    action: ActivityAction;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        tenantId: params.tenantId,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(tenantId: string, skip?: number, take?: number) {
    const prisma = this.prisma.getClient(tenantId);
    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        skip,
        take: take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
      }),
      prisma.activityLog.count(),
    ]);

    return { data, total };
  }

  async findOne(id: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const result = await prisma.activityLog.findFirst({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, role: true },
        },
      },
    });
    if (!result) {
      throw new NotFoundException(`Activity Log ${id} not found`);
    }
    return result;
  }
}
