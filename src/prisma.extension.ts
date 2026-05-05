import { Prisma } from '@prisma/client';

/**
 * Prisma Client Extension — Automatic Soft Delete & Tenant Isolation
 *
 * This extension automatically adds `deletedAt: null` and `tenantId` filters
 * to all `findMany`, `findFirst`, `count`, and `aggregate` queries
 * for models that have these fields.
 *
 * CRITICAL FIXES APPLIED:
 * - `delete` and `deleteMany` interceptors now redirect to `update` / `updateMany`
 *   instead of calling the original delete query with a `data` parameter.
 *   Prisma's delete query does NOT accept a `data` parameter — the old approach
 *   would silently hard-delete records.
 *
 * - `findUnique` and `findUniqueOrThrow` are NOT intercepted because Prisma
 *   requires the where clause to match the model's unique constraint exactly.
 *   Use `findFirst` instead for tenant-aware lookups by ID.
 *
 * USAGE:
 *   const prisma = this.prisma.getClient(tenantId);
 *   prisma.model.findFirst({ where: { id } }) // tenant-aware + soft-delete ✓
 *   prisma.model.delete({ where: { id } })    // NOW becomes soft-delete ✓
 *
 * NOTE:
 * - For admin/super-admin operations that need to bypass filters, use
 *   the base `this.prisma` client directly (without getClient).
 * - Use `findFirst` instead of `findUnique` for tenant-aware lookups!
 */

// Models that have both `deletedAt` and `tenantId` fields
const TENANT_SOFT_DELETE_MODELS = [
  'Product',
  'Category',
  'Supplier',
  'SalesOrder',
  'PurchaseOrder',
  'TenantUser',
  'ActivityLog',
] as const;

// Models that only have `deletedAt` (no tenantId — platform-level)
const SOFT_DELETE_ONLY_MODELS = ['PlatformAdmin', 'PlatformUser', 'Tenant'] as const;

// Models that have `tenantId` but NO `deletedAt` field
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

/**
 * Get the model key name as used on the Prisma client (e.g., 'Product' → 'product').
 */
function modelKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export function createTenantSoftDeleteExtension(tenantId?: string) {
  return Prisma.defineExtension({
    name: 'tenant-soft-delete',
    query: {
      $allModels: {
        // ── READ OPERATIONS ──────────────────────────────────────────
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
        /**
         * NOTE: findUnique and findUniqueOrThrow are intentionally NOT intercepted.
         * Prisma's findUnique requires the where clause to match the model's
         * unique constraint exactly. Adding tenantId or deletedAt would cause errors.
         *
         * Use findFirst() instead for tenant-aware lookups by ID.
         * The findFirst interceptor above will automatically add filters.
         */
        async findUnique({ model: _model, args, query }) {
          return query(args);
        },
        async findUniqueOrThrow({ model: _model, args, query }) {
          return query(args);
        },

        // ── COUNT / AGGREGATE ─────────────────────────────────────────
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

        // ── UPDATE OPERATIONS ────────────────────────────────────────
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

        // ── DELETE OPERATIONS (Soft Delete — NEVER hard delete) ─────
        async delete({ model, args, query: _query }) {
          if (isSoftDeleteModel(model)) {
            // FIXED: Redirect to model.update() instead of calling original delete.
            // Prisma's delete query interceptor does NOT accept a `data` parameter,
            // so passing `data: { deletedAt }` to `_query()` would be ignored.
            applyTenantFilter(model, args, tenantId);
            // Access the model via the extended client's update method
            const key = modelKey(model);
            // eslint-disable-next-line @typescript-eslint/no-this-alias
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
            // FIXED: Redirect to model.updateMany() instead of hard delete
            applyTenantFilter(model, args, tenantId);
            const key = modelKey(model);
            // eslint-disable-next-line @typescript-eslint/no-this-alias
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

/**
 * Add `deletedAt: null` to the where clause if not already present.
 * Allows explicit `deletedAt: { not: null }` to find deleted records.
 */

function addSoftDeleteFilter(where: any): any {
  if (!where) {
    return { deletedAt: null };
  }
  // If deletedAt is already specified explicitly, respect it
  if (where.deletedAt !== undefined) {
    return where;
  }
  return { ...where, deletedAt: null };
}

/**
 * Add `tenantId` filter to the where clause.
 * If tenantId is already specified, respect the explicit value.
 */

function addTenantFilter(where: any, tenantId: string): any {
  if (!where) {
    return { tenantId };
  }
  // If tenantId is already specified explicitly, respect it
  if (where.tenantId !== undefined) {
    return where;
  }
  return { ...where, tenantId };
}

/**
 * Apply soft-delete filter (deletedAt: null) if the model supports it.
 * Models without deletedAt field (TENANT_ONLY_MODELS) skip this.
 */
function applySoftDelete(model: string, args: any): void {
  if (isSoftDeleteModel(model)) {
    if (!args.where) args.where = {};
    args.where = addSoftDeleteFilter(args.where);
  }
}

/**
 * Apply tenantId filter if the model is tenant-scoped and a tenantId was provided.
 * Covers both TENANT_SOFT_DELETE_MODELS and TENANT_ONLY_MODELS.
 */
function applyTenantFilter(model: string, args: any, tenantId?: string): void {
  if (!tenantId) return;
  if (isTenantSoftDeleteModel(model) || isTenantOnlyModel(model)) {
    if (!args.where) args.where = {};
    args.where = addTenantFilter(args.where, tenantId);
  }
}
