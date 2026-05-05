-- CreateIndex
CREATE INDEX "activity_logs_tenantId_entity_createdAt_idx" ON "activity_logs"("tenantId", "entity", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_createdAt_idx" ON "purchase_orders"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "tenant_users_tenantId_role_idx" ON "tenant_users"("tenantId", "role");
