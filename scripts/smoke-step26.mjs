// Step 26 authenticated smoke walk.
//
// For each test user (patient/doctor/admin):
//   1. Sign in via Supabase to capture a session cookie pair
//   2. Walk every protected route they should reach
//   3. Capture HTTP status + total time
// Report sorted by slowest route.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const USERS = [
  {
    role: "PATIENT",
    email: "test.patient@nalavita.test",
    password: "TestPatient123!",
    routes: [
      "/patient/dashboard",
      "/patient/appointments",
      "/patient/medications",
      "/patient/vitals",
      "/patient/symptom-checker",
      "/patient/records",
      "/patient/prescriptions",
      "/patient/lab-results",
      "/patient/chat",
      "/patient/pharmacy",
      "/patient/payments",
      "/patient/mental-health",
      "/patient/settings",
    ],
  },
  {
    role: "DOCTOR",
    email: "test.doctor@nalavita.test",
    password: "TestDoctor123!",
    routes: [
      "/doctor/dashboard",
      "/doctor/appointments",
      "/doctor/patients",
      "/doctor/prescriptions",
      "/doctor/lab-orders",
      "/doctor/monitoring",
      "/doctor/referrals",
      "/doctor/billing",
      "/doctor/analytics",
      "/doctor/settings",
    ],
  },
  {
    role: "ADMIN",
    email: "test.admin@nalavita.test",
    password: "TestAdmin123!",
    routes: [
      "/admin/dashboard",
      "/admin/staff",
      "/admin/beds",
      "/admin/reports",
      "/admin/settings",
    ],
  },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return data.session;
}

function cookieHeaderFromSession(session) {
  // Supabase SSR stores the session in cookies the middleware can read.
  // The cookie name pattern is `sb-<project-ref>-auth-token` and the value
  // is a base64-encoded JSON of [access_token, refresh_token, ...].
  // For Next.js apps using @supabase/ssr, sending the access_token in the
  // Authorization header is NOT enough — middleware reads cookies.
  // We construct the chunked cookie pair the same way @supabase/ssr does.
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  // base64-prefixed format expected by @supabase/ssr v0.5+
  const encoded = "base64-" + Buffer.from(payload).toString("base64");
  // Chunked cookies: each chunk under ~3.5KB
  const chunks = [];
  const chunkSize = 3000;
  for (let i = 0; i < encoded.length; i += chunkSize) {
    chunks.push(encoded.slice(i, i + chunkSize));
  }
  if (chunks.length === 1) {
    return `sb-${projectRef}-auth-token=${chunks[0]}`;
  }
  return chunks
    .map((c, i) => `sb-${projectRef}-auth-token.${i}=${c}`)
    .join("; ");
}

async function timeRoute(url, cookie) {
  const start = Date.now();
  const res = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "follow",
  });
  const ms = Date.now() - start;
  return { status: res.status, finalUrl: res.url, ms };
}

async function main() {
  console.log(`Smoke target: ${BASE_URL}\n`);

  // Warm the JIT first so cold-start doesn't skew measurements
  console.log("Warming JIT...");
  await timeRoute(`${BASE_URL}/login`, null);
  await timeRoute(`${BASE_URL}/login`, null);
  console.log("Warmed.\n");

  const results = [];

  for (const user of USERS) {
    console.log(`=== ${user.role}: ${user.email} ===`);
    let cookie;
    try {
      const session = await signIn(user.email, user.password);
      cookie = cookieHeaderFromSession(session);
      console.log(`Signed in (token expires in ${session.expires_in}s)`);
    } catch (e) {
      console.error(`SKIP: ${e.message}`);
      continue;
    }

    for (const route of user.routes) {
      const { status, finalUrl, ms } = await timeRoute(`${BASE_URL}${route}`, cookie);
      const redirected = finalUrl.replace(BASE_URL, "") !== route;
      const flag = redirected ? `→ ${finalUrl.replace(BASE_URL, "")}` : "";
      console.log(`  ${String(ms).padStart(5)} ms  ${status}  ${route.padEnd(34)} ${flag}`);
      results.push({ role: user.role, route, status, ms, redirected });
    }
    console.log();
  }

  // Summary
  const slow = results.filter((r) => r.ms > 1500).sort((a, b) => b.ms - a.ms);
  const errors = results.filter((r) => r.status >= 400);
  const redirected = results.filter((r) => r.redirected);

  console.log("=== Summary ===");
  console.log(`Total routes:    ${results.length}`);
  console.log(`Errors (4xx/5xx): ${errors.length}`);
  console.log(`Redirected:      ${redirected.length}  (RBAC redirects mean the user shouldn't see that route — should be 0)`);
  console.log(`Slow (>1500ms):  ${slow.length}`);
  if (slow.length) {
    console.log("\nSlowest routes:");
    for (const r of slow.slice(0, 10)) {
      console.log(`  ${String(r.ms).padStart(5)} ms  ${r.role}  ${r.route}`);
    }
  }
  if (errors.length) {
    console.log("\nErrors:");
    for (const r of errors) {
      console.log(`  ${r.status}  ${r.role}  ${r.route}`);
    }
  }
  if (redirected.length) {
    console.log("\nUnexpected redirects:");
    for (const r of redirected) {
      console.log(`  ${r.role}  ${r.route}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
