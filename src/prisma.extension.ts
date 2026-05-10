import { Prisma } from '@prisma/client';

const TENANT_SOFT_DELETE_MODELS = [
  'Product',
  'Category',
  'Supplier',
  'SalesOrder',
  'PurchaseOrder',
  'TenantUser',
  'ActivityLog',
] as const;

const SOFT_DELETE_ONLY_MODELS = ['PlatformAdmin', 'PlatformUser', 'Tenant'] as const;

const TENANT_ONLY_MODELS = ['SalesReturn', 'StockTransaction'] as const;

type TenantSoftDeleteModel = (typeof TENANT_SOFT_DELETE_MODELS)[number];
type SoftDeleteOnlyModel = (typeof SOFT_DELETE_ONLY_MODELS)[number];
type TenantOnlyModel = (typeof TENANT_ONLY_MODELS)[number];

function isTenantSoftDeleteModel(model: string): model is TenantSoftDeleteModel {
  return (TENANT_SOFT_DELETE_MODELS as readonly string[]).includes(model);
}

function isSoftDeleteModel(model: string): model is TenantSoftDeleteModel | SoftDeleteOnlyModel {
  return (
    (TENANT_SOFT_DELETE_MODELS as readonly string[]).includes(model) ||
    (SOFT_DELETE_ONLY_MODELS as readonly string[]).includes(model)
  );
}

function isTenantOnlyModel(model: string): model is TenantOnlyModel {
  return (TENANT_ONLY_MODELS as readonly string[]).includes(model);
}

function modelKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export function createTenantSoftDeleteExtension(tenantId?: string) {
  return Prisma.defineExtension({
    name: 'tenant-soft-delete',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          applySoftDelete(model, args);
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },
        async findFirst({ model, args, query }) {
          applySoftDelete(model, args);
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },

        async findUnique({ model: _model, args, query }) {
          return query(args);
        },
        async findUniqueOrThrow({ model: _model, args, query }) {
          return query(args);
        },

        async count({ model, args, query }) {
          applySoftDelete(model, args);
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },
        async aggregate({ model, args, query }) {
          applySoftDelete(model, args);
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },
        async groupBy({ model, args, query }) {
          applySoftDelete(model, args);
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },

        async update({ model, args, query }) {
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },
        async updateMany({ model, args, query }) {
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },
        async upsert({ model, args, query }) {
          applyTenantFilter(model, args, tenantId);
          return query(args);
        },

        async delete({ model, args, query: _query }) {
          if (isSoftDeleteModel(model)) {
            applyTenantFilter(model, args, tenantId);

            const key = modelKey(model);

            const client: any = this;
            if (client[key]?.update) {
              return await client[key].update({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
          }
          return _query(args);
        },
        async deleteMany({ model, args, query: _query }) {
          if (isSoftDeleteModel(model)) {
            applyTenantFilter(model, args, tenantId);
            const key = modelKey(model);

            const client: any = this;
            if (client[key]?.updateMany) {
              return await client[key].updateMany({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
          }
          return _query(args);
        },
      },
    },
  });
}

function addSoftDeleteFilter(where: any): any {
  if (!where) {
    return { deletedAt: null };
  }

  if (where.deletedAt !== undefined) {
    return where;
  }
  return { ...where, deletedAt: null };
}

function addTenantFilter(where: any, tenantId: string): any {
  if (!where) {
    return { tenantId };
  }

  if (where.tenantId !== undefined) {
    return where;
  }
  return { ...where, tenantId };
}

function applySoftDelete(model: string, args: any): void {
  if (isSoftDeleteModel(model)) {
    if (!args.where) args.where = {};
    args.where = addSoftDeleteFilter(args.where);
  }
}

function applyTenantFilter(model: string, args: any, tenantId?: string): void {
  if (!tenantId) return;
  if (isTenantSoftDeleteModel(model) || isTenantOnlyModel(model)) {
    if (!args.where) args.where = {};
    args.where = addTenantFilter(args.where, tenantId);
  }
}
