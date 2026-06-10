// End-to-end auth'd smoke of the live Amelia endpoints.
// Signs in with the SAME library the app uses (so cookies match exactly),
// then calls the real endpoints against the running server on :3000.
// Run: node --env-file=.env scripts/smoke-amelia.mjs
import { createServerClient } from "@supabase/auth-helpers-nextjs";

const BASE = "http://localhost:3000";
const EMAIL = "test.patient@nalavita.test";
const PASSWORD = "TestPatient123!";

const jar = {};
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => { jar[name] = value; }),
    },
  }
);

function cookieHeader() {
  return Object.entries(jar)
    .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
    .join("; ");
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (error) {
  console.error("LOGIN FAILED:", error.message);
  process.exit(1);
}
console.log("✓ Signed in as", EMAIL, "—", Object.keys(jar).length, "auth cookie(s) captured\n");

// 1. Grounded chat (auth → Prisma context → gpt-4o)
const chat = await call("POST", "/api/amelia/chat", { message: "I've had a mild sore throat and a runny nose for two days. What could it be?" });
console.log("1) POST /api/amelia/chat (routine symptom):", chat.status);
console.log("   urgency:", chat.json?.reply?.urgency);
console.log("   reply  :", (chat.json?.reply?.content || chat.json?.error || "").slice(0, 220), "…\n");

// 2. Emergency hard-stop (deterministic, must NOT call the LLM)
const emerg = await call("POST", "/api/amelia/chat", { conversationId: chat.json?.conversationId, message: "I suddenly have crushing chest pain and can't breathe" });
console.log("2) POST /api/amelia/chat (emergency):", emerg.status);
console.log("   urgency:", emerg.json?.reply?.urgency, "(expect: emergency)");
console.log("   reply  :", (emerg.json?.reply?.content || "").slice(0, 160), "\n");

// 3. Medication safety (gpt-4o analysis of the patient's real meds)
const meds = await call("GET", "/api/amelia/med-safety");
console.log("3) GET /api/amelia/med-safety:", meds.status);
console.log("   interactions:", meds.json?.result?.interactions?.length, "· allergyConflicts:", meds.json?.result?.allergyConflicts?.length);
console.log("   note:", (meds.json?.result?.overallNote || meds.json?.error || "").slice(0, 160), "\n");

// 4. Reminders list (should be empty initially)
const rem = await call("GET", "/api/amelia/reminders");
console.log("4) GET /api/amelia/reminders:", rem.status, "· count:", rem.json?.reminders?.length);

console.log("\nDone.");
