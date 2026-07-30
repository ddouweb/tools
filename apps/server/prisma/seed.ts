import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

/** 初始化：超级管理员角色 + 默认 admin/admin 账号（仅 dev，生产请改密）。 */
async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: '超级管理员（isAdmin）', isAdmin: true },
  });

  const passwordHash = await hash('admin');
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      status: 'active',
      roles: { create: [{ roleId: adminRole.id }] },
    },
  });

  console.log('✓ seeded: admin / admin (role=admin, isAdmin=true)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
