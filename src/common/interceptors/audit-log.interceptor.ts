import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma.service';
import { ActivityAction } from '@prisma/client';

/**
 * Global Audit Log Interceptor
 *
 * Automatically logs all mutating operations (POST/PATCH/PUT/DELETE) to the
 * activity_logs table. This ensures no developer can forget to log an important
 * action — every Create, Update, and Delete is captured automatically.
 *
 * HOW IT WORKS:
 * - Intercepts all HTTP requests
 * - For mutating methods (POST/PATCH/PUT/DELETE), extracts the entity name
 *   from the route path (e.g., /products → "Product")
 * - After the request succeeds, logs the action to activity_logs
 * - Entity ID is extracted from route params (e.g., :id)
 *
 * ENTITY NAME MAPPING:
 *   /products/* → Product
 *   /categories/* → Category
 *   /suppliers/* → Supplier
 *   /sales/* → SalesOrder
 *   /purchase/* → PurchaseOrder
 *   /returns/* → SalesReturn
 *   /inventory/* → StockTransaction
 *   /users/* → TenantUser
 *
 * EXCLUSIONS:
 * - GET requests (read-only, no audit needed)
 * - Auth endpoints (login/logout are logged separately)
 * - Health check endpoints
 * - Upload endpoints
 * - AI endpoints
 *
 * USAGE:
 *   Register globally in main.ts:
 *     app.useGlobalInterceptors(new AuditLogInterceptor(prismaService));
 *
 *   Or apply per-module:
 *     providers: [{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }]
 */

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  // Routes to exclude from audit logging
  private readonly excludedPaths = ['/auth', '/health', '/upload', '/ai', '/ai-data'];

  // Map URL paths to entity names
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

  // Map HTTP methods to ActivityAction
  private readonly methodActionMap: Record<string, ActivityAction> = {
    POST: ActivityAction.CREATE,
    PATCH: ActivityAction.UPDATE,
    PUT: ActivityAction.UPDATE,
    DELETE: ActivityAction.DELETE,
  };

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method as string;
    const path = request.route?.path || request.url || '';

    // Skip GET requests and excluded paths
    if (method === 'GET') {
      return next.handle();
    }

    const isExcluded = this.excludedPaths.some(
      (excluded) => path.startsWith(excluded) || path.startsWith(`/${excluded}`),
    );
    if (isExcluded) {
      return next.handle();
    }

    // Extract entity name from path
    const entity = this.extractEntity(path);
    if (!entity) {
      return next.handle();
    }

    // Extract entity ID from route params
    const entityId = request.params?.id || undefined;

    // Extract user info
    const user = request.user as { id?: string; tenantId?: string } | undefined;
    const userId = user?.id || 'system';
    const tenantId = user?.tenantId;

    const action = this.methodActionMap[method] || ActivityAction.UPDATE;

    return next.handle().pipe(
      tap({
        next: () => {
          // Log asynchronously — don't block the response
          this.logActivity(action, entity, entityId, userId, tenantId, request.body).catch(
            (err) => {
              this.logger.error(`Failed to log audit activity: ${err.message}`, err.stack);
            },
          );
        },
        error: () => {
          // Don't log failed requests
        },
      }),
    );
  }

  private extractEntity(path: string): string | null {
    // Remove leading slash and split
    const segments = path.replace(/^\/+/, '').split('/');

    // The first segment is usually the entity name
    // Handle paths like /api/products or /products
    const firstSegment = segments[0] || '';

    // Handle versioned APIs like /api/v1/products
    const entitySegment =
      firstSegment === 'api' && segments.length > 1 ? segments[1] : firstSegment;

    return this.entityMap[entitySegment] || null;
  }

  private async logActivity(
    action: ActivityAction,
    entity: string,
    entityId: string | undefined,
    userId: string,
    tenantId: string | undefined,
    body: any,
  ): Promise<void> {
    // Build metadata from request body (sanitized)
    const metadata: Record<string, unknown> = {};

    if (body) {
      // Only include safe fields — exclude sensitive data
      const safeBody = { ...body };
      delete safeBody.password;
      delete safeBody.passwordHash;
      delete safeBody.currentPassword;
      delete safeBody.newPassword;
      delete safeBody.token;
      delete safeBody.refreshToken;

      if (Object.keys(safeBody).length > 0) {
        metadata.requestBody = safeBody;
      }
    }

    // Only log if we have a valid tenantId — skip for super admin / system actions
    // that don't belong to any tenant
    if (!tenantId) {
      this.logger.warn(
        `Skipping audit log: no tenantId for action=${action} entity=${entity} entityId=${entityId}`,
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
        metadata: metadata as any,
      },
    });
  }
}
