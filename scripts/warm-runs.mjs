import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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

const { data } = await supabase.auth.signInWithPassword({
  email: "test.patient@nalavita.test",
  password: "TestPatient123!",
});
const cookie = cookieFor(data.session);

// 5 warm runs of /patient/dashboard
console.log("Warm runs of /patient/dashboard:");
for (let i = 1; i <= 5; i++) {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/patient/dashboard", { headers: { Cookie: cookie } });
  await res.text();
  console.log(`  run ${i}: ${Date.now() - start} ms  (${res.status})`);
}

// Same for doctor and admin
const { data: dr } = await supabase.auth.signInWithPassword({
  email: "test.doctor@nalavita.test",
  password: "TestDoctor123!",
});
const drCookie = cookieFor(dr.session);
console.log("\nWarm runs of /doctor/dashboard:");
for (let i = 1; i <= 5; i++) {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/doctor/dashboard", { headers: { Cookie: drCookie } });
  await res.text();
  console.log(`  run ${i}: ${Date.now() - start} ms  (${res.status})`);
}

const { data: ad } = await supabase.auth.signInWithPassword({
  email: "test.admin@nalavita.test",
  password: "TestAdmin123!",
});
const adCookie = cookieFor(ad.session);
console.log("\nWarm runs of /admin/dashboard:");
for (let i = 1; i <= 5; i++) {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/admin/dashboard", { headers: { Cookie: adCookie } });
  await res.text();
  console.log(`  run ${i}: ${Date.now() - start} ms  (${res.status})`);
}
