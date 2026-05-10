-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "tenant_users_email_deletedAt_idx" ON "tenant_users"("email", "deletedAt");
