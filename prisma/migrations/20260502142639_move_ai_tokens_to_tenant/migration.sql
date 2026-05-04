/*
  Warnings:

  - You are about to drop the column `aiTokens` on the `tenant_users` table. All the data in the column will be lost.
  - You are about to drop the column `aiTokensUsed` on the `tenant_users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tenant_users" DROP COLUMN "aiTokens",
DROP COLUMN "aiTokensUsed";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "aiTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiTokensUsed" INTEGER NOT NULL DEFAULT 0;
