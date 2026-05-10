import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma.service';
import { ActivityAction, Prisma } from '@prisma/client';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  private readonly excludedPaths = ['/auth', '/health', '/upload', '/ai', '/ai-data'];

  private readonly entityMap: Record<string, string> = {
    products: 'Product',
    categories: 'Category',
    suppliers: 'Supplier',
    sales: 'SalesOrder',
    'sales-orders': 'SalesOrder',
    purchase: 'PurchaseOrder',
    'purchase-orders': 'PurchaseOrder',
    returns: 'SalesReturn',
    inventory: 'StockTransaction',
    users: 'TenantUser',
    'activity-logs': 'ActivityLog',
    dashboard: 'Dashboard',
    reports: 'Report',
    admin: 'Admin',
  };

  private readonly methodActionMap: Record<string, ActivityAction> = {
    POST: ActivityAction.CREATE,
    PATCH: ActivityAction.UPDATE,
    PUT: ActivityAction.UPDATE,
    DELETE: ActivityAction.DELETE,
  };

  private readonly prismaEntityMap: Record<string, string> = {
    Product: 'product',
    Category: 'category',
    Supplier: 'supplier',
    SalesOrder: 'salesOrder',
    PurchaseOrder: 'purchaseOrder',
    SalesReturn: 'salesReturn',
    StockTransaction: 'stockTransaction',
    TenantUser: 'tenantUser',
    ActivityLog: 'activityLog',
  };

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method as string;
    const path = request.route?.path || request.url || '';

    if (method === 'GET') {
      return next.handle();
    }

    const isExcluded = this.excludedPaths.some(
      (excluded) => path.startsWith(excluded) || path.startsWith(`/${excluded}`),
    );
    if (isExcluded) {
      return next.handle();
    }

    const entity = this.extractEntity(path);
    if (!entity) {
      return next.handle();
    }

    const entityId = request.params?.id || undefined;
    const user = request.user as { id?: string; tenantId?: string } | undefined;
    const userId = user?.id || 'system';
    const tenantId = user?.tenantId;
    const action = this.methodActionMap[method] || ActivityAction.UPDATE;

    let beforeState: Record<string, unknown> | null = null;
    const needsSnapshot = ['PATCH', 'PUT', 'DELETE'].includes(method) && entityId && tenantId;

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          (async () => {
            try {
              if (needsSnapshot) {
                beforeState = await this.captureBeforeState(entity, entityId);
              }

              const metadata: Record<string, unknown> = {};

              if (beforeState) {
                metadata.before = this.sanitizeSnapshot(beforeState);
              }

              if (request.body && Object.keys(request.body).length > 0) {
                const safeBody = { ...request.body };
                delete safeBody.password;
                delete safeBody.passwordHash;
                delete safeBody.currentPassword;
                delete safeBody.newPassword;
                delete safeBody.token;
                delete safeBody.refreshToken;
                if (Object.keys(safeBody).length > 0) {
                  metadata.after = safeBody;
                }
              }

              if (!tenantId) {
                this.logger.warn(
                  `Skipping audit log: no tenantId for action=${action} entity=${entity}`,
                );
                return;
              }

              await this.prisma.activityLog.create({
                data: {
                  userId,
                  action,
                  entity,
                  entityId,
                  tenantId,
                  metadata: metadata as Prisma.InputJsonValue,
                },
              });
            } catch (err) {
              this.logger.error(`Failed to log audit activity: ${err.message}`, err.stack);
            }
          })().catch(() => {});
        },
        error: () => {},
      }),
    );
  }

  private extractEntity(path: string): string | null {
    const segments = path.replace(/^\/+/, '').split('/');
    const firstSegment = segments[0] || '';
    const entitySegment =
      firstSegment === 'api' && segments.length > 1 ? segments[1] : firstSegment;
    return this.entityMap[entitySegment] || null;
  }

  private async captureBeforeState(
    entity: string,
    entityId: string,
  ): Promise<Record<string, unknown> | null> {
    const prismaModel = this.prismaEntityMap[entity];
    if (!prismaModel) return null;

    const delegate = (this.prisma as unknown as Record<string, unknown>)[prismaModel];
    if (!delegate || typeof (delegate as Record<string, unknown>).findUnique !== 'function') {
      return null;
    }

    const record = await (
      delegate as { findUnique: (args: { where: { id: string } }) => unknown }
    ).findUnique({ where: { id: entityId } });

    return record as Record<string, unknown> | null;
  }

  private sanitizeSnapshot(record: Record<string, unknown>): Record<string, unknown> {
    if (!record) return {};
    const safe = { ...record };
    delete safe.passwordHash;
    delete safe.password;
    delete safe.token;
    delete safe.refreshToken;
    delete safe.aiApiKey;
    return safe;
  }
}
