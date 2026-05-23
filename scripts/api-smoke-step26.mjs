// Step 26 API endpoint smoke.
// Sign in as each role, hit each /api/* endpoint with valid auth,
// capture status + timing. Distinguish:
//   - 200/2xx = healthy
//   - 401/403 = RBAC denial (expected for cross-role hits)
//   - 404 = route not found
//   - 5xx = server error (the actual bug surface)

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config();

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

function cookieFor(session) {
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  return `sb-${projectRef}-auth-token=base64-${Buffer.from(payload).toString("base64")}`;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return cookieFor(data.session);
}

// (method, path, role): hit this URL with this role's cookie
const REQUESTS = [
  // === As patient ===
  ["GET", "/api/patients/me", "PATIENT"],
  ["GET", "/api/appointments", "PATIENT"],
  ["GET", "/api/medications", "PATIENT"],
  ["GET", "/api/vitals", "PATIENT"],
  ["GET", "/api/prescriptions", "PATIENT"],
  ["GET", "/api/records", "PATIENT"],
  ["GET", "/api/notifications", "PATIENT"],
  ["GET", "/api/payments", "PATIENT"],
  ["GET", "/api/mental-health", "PATIENT"],

  // === As doctor ===
  ["GET", "/api/appointments", "DOCTOR"],
  ["GET", "/api/doctors", "DOCTOR"],
  ["GET", "/api/prescriptions", "DOCTOR"],
  ["GET", "/api/referrals", "DOCTOR"],
  ["GET", "/api/medications", "DOCTOR"],

  // === As admin ===
  ["GET", "/api/admin/reports", "ADMIN"],
];

async function main() {
  const cookies = {
    PATIENT: await signIn("test.patient@nalavita.test", "TestPatient123!"),
    DOCTOR: await signIn("test.doctor@nalavita.test", "TestDoctor123!"),
    ADMIN: await signIn("test.admin@nalavita.test", "TestAdmin123!"),
  };

  // Warm
  await fetch(`${BASE_URL}/api/notifications`, { headers: { Cookie: cookies.PATIENT } });

  const results = [];
  for (const [method, path, role] of REQUESTS) {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Cookie: cookies[role] },
    });
    const ms = Date.now() - start;
    let body = "";
    try {
      body = await res.text();
    } catch {
      body = "(unreadable)";
    }
    const preview = body.slice(0, 80).replace(/\s+/g, " ");
    results.push({ role, method, path, status: res.status, ms, preview });
    console.log(`  ${String(ms).padStart(5)} ms  ${res.status}  ${role.padEnd(8)} ${method.padEnd(4)} ${path.padEnd(28)} ${preview}`);
  }

  console.log("\n=== Summary ===");
  console.log("Total: " + results.length);
  console.log("2xx OK: " + results.filter(r => r.status >= 200 && r.status < 300).length);
  console.log("3xx redirect: " + results.filter(r => r.status >= 300 && r.status < 400).length);
  console.log("4xx client: " + results.filter(r => r.status >= 400 && r.status < 500).length);
  console.log("5xx server: " + results.filter(r => r.status >= 500).length);
  const errors = results.filter(r => r.status >= 500);
  if (errors.length) {
    console.log("\nServer errors (bugs to fix):");
    for (const r of errors) console.log(`  ${r.status}  ${r.role}  ${r.method} ${r.path}  →  ${r.preview}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
