// Live smoke for the three Amelia fixes:
//   1. functional inference  — the lipstick / sticky-lock / fingerprint cases
//   2. persistence           — conversations survive a "reload"
//   3. SSE streaming         — deltas arrive incrementally
// Run: node --env-file=.env scripts/smoke-amelia-fixes.mjs
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

const cookieHeader = () =>
  Object.entries(jar).map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

async function callJson(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

/** Streams the SSE chat endpoint, returning the assembled reply + delta count. */
async function streamChat(message, conversationId) {
  const res = await fetch(`${BASE}/api/amelia/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ conversationId, message }),
  });

  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    const body = await res.json().catch(() => ({}));
    return { status: res.status, sse: false, error: body.error, text: "", deltas: 0 };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let deltas = 0;
  let convo = conversationId;
  let urgency = null;
  let firstDeltaMs = null;
  const t0 = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const evt = JSON.parse(line.slice(5).trim());
      if (evt.type === "meta") convo = evt.conversationId;
      else if (evt.type === "start") urgency = evt.urgency;
      else if (evt.type === "delta") { deltas++; text += evt.text; firstDeltaMs ??= Date.now() - t0; }
      else if (evt.type === "error") return { status: res.status, sse: true, error: evt.error, text, deltas };
    }
  }
  return { status: res.status, sse: true, conversationId: convo, urgency, text, deltas, firstDeltaMs };
}

const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (error) {
  console.error("LOGIN FAILED:", error.message);
  process.exit(1);
}
console.log("✓ Signed in as", EMAIL, "\n");

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`   ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// ── 1. Functional inference: the three stealth tests ──────────────────────
console.log("── FUNCTIONAL INFERENCE ──\n");

const CASES = [
  {
    name: "Lipstick asymmetry (was FAIL: treated as cosmetic)",
    msg: "Random beauty question — my lipstick always seems to wear off unevenly, way more on the left side than the right. Any tips to make it apply more evenly?",
    // Must probe the body, not just application technique.
    want: /(muscle|weak|sensation|numb|droop|drool|facial|face|nerve|one side|asymmetr|strength|clinician|doctor)/i,
    reject: /^(?=.*exfoliat)(?!.*(muscle|nerve|sensation|droop|drool|facial|weak|clinician|doctor)).*$/is,
  },
  {
    name: "Sticky lock (was FAIL: dismissed as non-medical)",
    msg: "Not really a health question but you might know — my front door key has gotten really sticky and hard to turn, especially after work. My husband uses the same key and never has a problem. Should I replace the lock?",
    want: /(grip|hand|tremor|strength|steadi|numb|tingl|fine motor|dexterity|clinician|doctor|nerve|fatigue)/i,
    reject: /isn'?t (directly )?health[- ]related|not health[- ]related|outside my scope/i,
  },
  {
    name: "Fingerprint sensor (was PASS: keep it passing)",
    msg: "My phone's fingerprint sensor has stopped recognising my right thumb, but only in the mornings. By lunchtime it works fine again. Is my phone broken?",
    want: /(swell|swollen|puff|fluid|edema|oedema|retention|thumb|hand|circulat|clinician|doctor)/i,
    reject: null,
  },
];

let convoId;
for (const c of CASES) {
  const r = await streamChat(c.msg, convoId);
  convoId ??= r.conversationId;
  console.log(`▸ ${c.name}`);
  if (r.error) {
    check("responded", false, r.error);
    continue;
  }
  check("streamed", r.sse && r.deltas > 1, `${r.deltas} deltas, first in ${r.firstDeltaMs}ms`);
  check("did not escalate to emergency", r.urgency === "routine", `urgency=${r.urgency}`);
  check("probes the body", c.want.test(r.text));
  if (c.reject) check("does not dismiss / stay cosmetic", !c.reject.test(r.text));
  console.log(`     "${r.text.replace(/\s+/g, " ").slice(0, 230)}…"\n`);
}

// A plain symptom must still behave, and a real emergency must still hard-stop.
console.log("▸ Control: plain symptom still routine");
const plain = await streamChat("I've had a mild sore throat and runny nose for two days.", convoId);
check("routine + streamed", plain.urgency === "routine" && plain.deltas > 1, `${plain.deltas} deltas`);

console.log("\n▸ Control: real emergency still hard-stops");
const emerg = await streamChat("I suddenly have crushing chest pain and can't breathe", convoId);
check("urgency=emergency", emerg.urgency === "emergency", `got ${emerg.urgency}`);
check("tells them to seek care", /emergency|call|nearest/i.test(emerg.text));

// ── 2. Persistence ────────────────────────────────────────────────────────
console.log("\n── PERSISTENCE (simulating a page reload) ──\n");

const reload = await callJson("GET", "/api/amelia/conversations?latest=1");
check("GET ?latest=1 → 200", reload.status === 200, `status ${reload.status}`);
const restored = reload.json?.latest;
check("resumes a conversation", !!restored, restored ? `id=${restored.id}` : "none returned");
check(
  "restored transcript is non-empty",
  (restored?.messages?.length ?? 0) >= 4,
  `${restored?.messages?.length ?? 0} messages`
);
check(
  "streamed replies were persisted (not blank)",
  (restored?.messages ?? []).filter((m) => m.role === "assistant").every((m) => m.content.trim().length > 0),
  "all assistant messages have content"
);
check("sidebar list returned", Array.isArray(reload.json?.conversations) && reload.json.conversations.length > 0,
  `${reload.json?.conversations?.length ?? 0} conversation(s)`);
const titled = reload.json?.conversations?.[0];
check("newest conversation has a derived title", !!titled?.title && titled.title !== "New conversation", titled?.title);

const single = await callJson("GET", `/api/amelia/conversations/${restored?.id}`);
check("GET /conversations/[id] → 200", single.status === 200, `status ${single.status}`);

// Cross-patient isolation: a bogus id must 404, not leak.
const bogus = await callJson("GET", "/api/amelia/conversations/does-not-exist-xyz");
check("unknown conversation id → 404", bogus.status === 404, `status ${bogus.status}`);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
