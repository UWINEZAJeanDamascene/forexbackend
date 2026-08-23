import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

function cleanDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('channel_binding')) {
      u.searchParams.delete('channel_binding');
    }
    return u.toString();
  } catch {
    return url;
  }
}

function createPrismaClient(): PrismaClient {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Analysis history requires a PostgreSQL database.');
  }

  const adapter = new PrismaPg({ connectionString: cleanDatabaseUrl(env.databaseUrl) });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

export { prisma };
