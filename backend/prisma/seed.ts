import { PrismaClient, UserRole, PersonType } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * PRODUCTION INITIALIZATION SCRIPT
 *
 * POLICY:
 * - Creates ONLY the required Administrator account if no Admin exists.
 * - If an Admin account already exists, leaves it completely untouched.
 * - Does NOT create ANY demo products, dealers, suppliers, salesmen,
 *   targets, handovers, stock movements, expenses, or transactions.
 * - Safe for automated production deployments and migrations.
 */
async function main() {
  console.log('🛡️ Production Database Initialization Check...');

  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    include: { person: true }
  });

  if (existingAdmin) {
    console.log(`  ✔ Existing Administrator verified: username="${existingAdmin.username}" (ID: ${existingAdmin.id})`);
    console.log(`  ✔ Linked Person: ${existingAdmin.person?.name || 'None'} (ID: ${existingAdmin.personId || 'None'})`);
    console.log('  ✔ Administrator account preserved untouched. Zero demo records created.');
    console.log('✅ Production Database Ready.');
    return;
  }

  console.log('  No Administrator found. Initializing default production Admin account...');

  let adminPerson = await prisma.person.findFirst({
    where: { phone: '+919876500001' },
  });

  if (!adminPerson) {
    adminPerson = await prisma.person.create({
      data: {
        name: 'System Administrator',
        phone: '+919876500001',
        type: PersonType.STAFF,
        active: true,
      },
    });
  }

  const rawPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@12345';
  const adminPasswordHash = await argon2.hash(rawPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const newAdmin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@crackershub.local',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      personId: adminPerson.id,
      isActive: true,
    },
  });

  console.log(`  ✔ Admin user initialized: username="${newAdmin.username}" (ID: ${newAdmin.id})`);
  console.log('  ✔ ZERO demo business data created. Ready for real business data entry.');
  console.log('✅ Production Database Initialization Complete.');
}

main()
  .catch((e) => {
    console.error('❌ Production initialization failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
