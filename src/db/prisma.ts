import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      // Append connection pool params if not already in DATABASE_URL
      url: process.env.DATABASE_URL,
    },
  },
});

// Graceful connection handling for production
// Prisma manages its own connection pool (default: num_physical_cpus * 2 + 1)
// Override with ?connection_limit=N in DATABASE_URL if needed

export default prisma;
