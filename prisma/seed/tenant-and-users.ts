import { PrismaClient, TenantRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedTenantAndUsers(
  prisma: PrismaClient,
  adminPassword: string,
  staffPassword: string,
  superAdminPassword: string,
) {
  // --- Tenant ---
  console.log('🏪 Creating Tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Default Store',
      slug: 'default-store',
      aiTokens: 10000,
      aiTokensUsed: 0,
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (${tenant.slug})`);

  // --- Platform User ---
  console.log('👤 Creating Platform User...');
  const platformUser = await prisma.platformUser.create({
    data: {
      email: 'owner@inventory.com',
      name: 'Store Owner',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`✅ Platform User created: ${platformUser.email}`);

  // --- Tenant Member ---
  console.log('🔗 Creating Tenant Member...');
  await prisma.tenantMember.create({
    data: {
      role: 'OWNER',
      platformUserId: platformUser.id,
      tenantId: tenant.id,
    },
  });
  console.log('✅ Tenant Member created.');

  // --- Tenant Users ---
  console.log('👤 Creating Tenant Users...');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

  const adminUser = await prisma.tenantUser.create({
    data: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: TenantRole.ADMIN,
      displayName: 'Admin',
      tenantId: tenant.id,
    },
  });

  const staffUser = await prisma.tenantUser.create({
    data: {
      username: 'staff',
      passwordHash: staffPasswordHash,
      role: TenantRole.STAFF,
      displayName: 'Staff',
      tenantId: tenant.id,
    },
  });
  console.log(`✅ Tenant Users created: ${adminUser.username} & ${staffUser.username}.`);

  // --- Platform Admin ---
  console.log('🛡️ Creating Platform Admin (Super Admin)...');
  await prisma.platformAdmin.create({
    data: {
      email: 'superadmin@crack.com',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash(superAdminPassword, 10),
    },
  });
  console.log('✅ Platform Admin created: superadmin@crack.com');

  return { tenant, adminUser, staffUser };
}
