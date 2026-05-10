
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.tenantUser.findFirst({
      where: {
        username: 'test',
        deletedAt: null,
      },
    });
    console.log('Result:', user);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
