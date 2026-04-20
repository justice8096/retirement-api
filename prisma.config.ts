// Prisma 7 config file. Holds the migration / introspection connection
// (schema tools need the connection string at CLI time). The runtime
// PrismaClient gets its own connection via a driver adapter in
// src/db/prisma.ts — this file is CLI-only.
//
// https://pris.ly/d/config-datasource
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
