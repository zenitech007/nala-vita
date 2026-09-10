/**
 * Runtime environment variable validation.
 *
 * Import this module at the top of `src/lib/prisma.ts` or any other
 * server-side entrypoint to catch missing env vars at startup rather
 * than at the first request that needs them.
 *
 * Usage:
 *   import "@/lib/env";
 */

const REQUIRED_SERVER = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
] as const;

const REQUIRED_PAYSTACK = [
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_WEBHOOK_SECRET",
] as const;

function assertEnv(vars: readonly string[], group: string) {
  const missing: string[] = [];

  for (const key of vars) {
    const val = process.env[key];
    if (!val || val.startsWith("REPLACE_ME") || val === "your_stripe_webhook_secret") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    // In production, throw hard so the app never starts with broken config.
    // In development, print a clear warning.
    const message =
      `[env] Missing or placeholder ${group} environment variable(s):\n` +
      missing.map((k) => `  • ${k}`).join("\n") +
      "\n\nCopy .env.example to .env and fill in real values.";

    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    } else {
      console.warn("\n⚠️  " + message + "\n");
    }
  }
}

// Only validate on the server side (not in the browser bundle)
if (typeof window === "undefined") {
  assertEnv(REQUIRED_SERVER, "core");

  // Paystack keys — warn but don't crash in dev
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!paystackSecret || paystackSecret.startsWith("REPLACE_ME")) {
    console.warn(
      "\n⚠️  [env] PAYSTACK_SECRET_KEY is not set or is a placeholder.\n" +
      "    Payments will not work until real Paystack keys are configured.\n"
    );
  }

  if (process.env.NODE_ENV === "production") {
    assertEnv(REQUIRED_PAYSTACK, "Paystack");
  }
}

export {};
