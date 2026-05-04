-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_stockQuantity_reorderLevel_tenantId_idx" ON "products"("stockQuantity", "reorderLevel", "tenantId");

-- CreateIndex
CREATE INDEX "tenant_users_username_deletedAt_idx" ON "tenant_users"("username", "deletedAt");
