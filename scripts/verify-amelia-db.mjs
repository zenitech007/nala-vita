// One-off runtime check: confirm the new Amelia tables exist + are queryable,
// existing data survived the Supabase pause, and a seeded patient is present.
// Run: node --env-file=.env scripts/verify-amelia-db.mjs
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const [convos, msgs, mems, rems, patients, users] = await Promise.all([
    prisma.ameliaConversation.count(),
    prisma.ameliaMessage.count(),
    prisma.ameliaMemory.count(),
    prisma.reminder.count(),
    prisma.patient.count(),
    prisma.user.count(),
  ]);
  console.log("OK — new Amelia tables are queryable:");
  console.log("  amelia_conversations:", convos);
  console.log("  amelia_messages:    ", msgs);
  console.log("  amelia_memories:    ", mems);
  console.log("  reminders:          ", rems);
  console.log("Existing data preserved:");
  console.log("  users:   ", users);
  console.log("  patients:", patients);
  const seeded = await prisma.user.findFirst({
    where: { role: "PATIENT" },
    select: { email: true },
  });
  console.log("A patient user for smoke testing:", seeded?.email ?? "(none — re-seed needed)");
} catch (e) {
  console.error("VERIFY FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
