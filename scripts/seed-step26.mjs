// Step 26 seed: idempotently create 1 patient + 1 doctor + 1 admin
// (Supabase auth user + Prisma row) so we can walk authenticated flows.
//
// Run: node scripts/seed-step26.mjs
//
// Required env (loaded from .env):
//   SUPABASE_SERVICE_ROLE_KEY  — to create auth users
//   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
//   DATABASE_URL               — Prisma pooled URL
//
// Output: writes to stdout the supabaseId + role for each test user,
// plus their plaintext passwords (test only — these accounts are throw-
// away).

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";

config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_USERS = [
  {
    role: "PATIENT",
    email: "test.patient@nalavita.test",
    password: "TestPatient123!",
    firstName: "Test",
    lastName: "Patient",
    patient: {
      dateOfBirth: new Date("1990-03-15"),
      gender: "Female",
      bloodType: "O+",
      allergies: ["Peanuts"],
      address: "123 Test Street, Lagos",
      emergencyName: "Test Contact",
      emergencyPhone: "+2348000000001",
    },
  },
  {
    role: "DOCTOR",
    email: "test.doctor@nalavita.test",
    password: "TestDoctor123!",
    firstName: "Dr. Test",
    lastName: "Doctor",
    doctor: {
      specialization: "General Practice",
      licenseNumber: "TEST-MD-001",
      yearsOfExperience: 10,
      bio: "Test doctor account for Step 26 verification.",
      consultationFee: 5000,
      availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      availableFrom: "09:00",
      availableTo: "17:00",
      isVerified: true,
    },
  },
  {
    role: "ADMIN",
    email: "test.admin@nalavita.test",
    password: "TestAdmin123!",
    firstName: "Test",
    lastName: "Admin",
    admin: {
      department: "Hospital Operations",
      permissions: ["manage_staff", "view_reports", "assign_beds"],
    },
  },
];

async function ensureSupabaseUser(spec) {
  // Check whether the user exists (idempotent)
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === spec.email);

  if (existing) {
    console.log(`  [supabase] ${spec.email} already exists (id=${existing.id})`);
    // Update password so we always know it (test accounts)
    await supabase.auth.admin.updateUserById(existing.id, {
      password: spec.password,
      user_metadata: { role: spec.role, firstName: spec.firstName, lastName: spec.lastName },
    });
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true, // skip the confirmation email loop
    user_metadata: { role: spec.role, firstName: spec.firstName, lastName: spec.lastName },
  });
  if (error) throw error;
  console.log(`  [supabase] created ${spec.email} (id=${data.user.id})`);
  return data.user.id;
}

async function ensurePrismaUser(spec, supabaseId) {
  const user = await prisma.user.upsert({
    where: { supabaseId },
    update: {
      email: spec.email,
      firstName: spec.firstName,
      lastName: spec.lastName,
      role: spec.role,
      emailVerified: true,
      isActive: true,
    },
    create: {
      supabaseId,
      email: spec.email,
      firstName: spec.firstName,
      lastName: spec.lastName,
      role: spec.role,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`  [prisma] user ${user.id} (role=${user.role})`);

  if (spec.role === "PATIENT") {
    await prisma.patient.upsert({
      where: { userId: user.id },
      update: spec.patient,
      create: { userId: user.id, ...spec.patient },
    });
    console.log(`  [prisma] patient profile linked`);
  } else if (spec.role === "DOCTOR") {
    await prisma.doctor.upsert({
      where: { userId: user.id },
      update: spec.doctor,
      create: { userId: user.id, ...spec.doctor },
    });
    console.log(`  [prisma] doctor profile linked`);
  } else if (spec.role === "ADMIN") {
    await prisma.admin.upsert({
      where: { userId: user.id },
      update: spec.admin,
      create: { userId: user.id, ...spec.admin },
    });
    console.log(`  [prisma] admin profile linked`);
  }
  return user;
}

async function main() {
  console.log("=== Step 26 seed ===\n");
  const created = [];
  for (const spec of TEST_USERS) {
    console.log(`${spec.role}: ${spec.email}`);
    const supabaseId = await ensureSupabaseUser(spec);
    const user = await ensurePrismaUser(spec, supabaseId);
    created.push({ role: spec.role, email: spec.email, password: spec.password, supabaseId, prismaId: user.id });
    console.log();
  }

  console.log("=== Test credentials ===");
  for (const u of created) {
    console.log(`${u.role.padEnd(8)} ${u.email}  ${u.password}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
