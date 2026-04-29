import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActivityAction } from '@prisma/client';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
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
        metadata: (params.metadata ?? {}) as any,
      },
    });
  }

  async findAll(skip?: number, take?: number) {
    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        skip,
        take: take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
      }),
      this.prisma.activityLog.count(),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    return this.prisma.activityLog.findUniqueOrThrow({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, role: true },
        },
      },
    });
  }
}
