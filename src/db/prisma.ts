// Prisma 7 moved the runtime connection off the schema `datasource { url }`
// block and onto an explicit driver adapter passed to PrismaClient. For
// PostgreSQL we use @prisma/adapter-pg. Connection-pool tuning still
// lives on the DATABASE_URL (?connection_limit=N) — the adapter reads
// it through the same env var.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
