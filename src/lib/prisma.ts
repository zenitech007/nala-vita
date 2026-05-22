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
    // ✅ FIX: cap connections to avoid exhausting Supabase's pool
    max: 10,
    // ✅ FIX: release idle connections after 30s to free up slots
    idleTimeoutMillis: 30_000,
    // ✅ FIX: fail fast if a connection can't be obtained within 10s
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}