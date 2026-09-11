// Validate required environment variables at startup
import "@/lib/env";

import { Pool } from "pg";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 15,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Unconditionally preserve the client across requests in both dev and serverless environments
globalForPrisma.prisma = prisma;