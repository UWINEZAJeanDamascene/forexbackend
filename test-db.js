const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = 'postgresql://neondb_owner:npg_4WbmlJ6zAqoN@ep-winter-glade-b2xhtm4g-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require';
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  try {
    const list = await prisma.analysis.findMany({ take: 1 });
    console.log('DB OK, analyses:', list.length);
  } catch (e) {
    console.error('DB FAIL');
    console.error(JSON.stringify(e, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
