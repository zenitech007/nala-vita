"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";

export default function PasswordRecoveryForm({ mode, expired = false }: { mode: "request" | "update"; expired?: boolean }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(expired ? "This reset link is invalid or expired. Request another link." : "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "update" && password !== confirmation) {
      setError("The passwords must match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(mode === "request" ? "/api/auth/forgot-password" : "/api/auth/update-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "request" ? { email } : { password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "The request failed. Please retry.");
        return;
      }
      setMessage(mode === "request" ? data.message : "Your password has been updated. Sign in with your new password.");
    } catch {
      setError("Could not reach the service. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-gray-900">{mode === "request" ? "Reset your password" : "Choose a new password"}</h1>
        <p className="mt-2 text-sm text-gray-600">{mode === "request" ? "Enter your account email to request a reset link." : "Use a password between 8 and 128 characters."}</p>
        {error && <p id={id + "-error"} role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 text-sm text-gray-700">{message}</p>}
        {!(mode === "update" && message) && <form onSubmit={submit} className="mt-6 space-y-4" aria-describedby={error ? id + "-error" : undefined}>
          {mode === "request" ? <div>
            <label htmlFor={id + "-email"} className="mb-1 block text-sm font-medium">Email address</label>
            <input id={id + "-email"} type="email" autoComplete="email" required maxLength={254} value={email}
              onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-3" />
          </div> : <>
            <div>
              <label htmlFor={id + "-password"} className="mb-1 block text-sm font-medium">New password</label>
              <input id={id + "-password"} type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-3" />
            </div>
            <div>
              <label htmlFor={id + "-confirmation"} className="mb-1 block text-sm font-medium">Confirm new password</label>
              <input id={id + "-confirmation"} type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                aria-invalid={error.includes("match") || undefined} aria-describedby={error ? id + "-error" : undefined}
                value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-3" />
            </div>
          </>}
          <button type="submit" disabled={busy} className="brand-action w-full rounded-lg px-4 py-3 font-semibold">
            {busy ? "Please wait…" : mode === "request" ? "Send reset link" : "Update password"}
          </button>
        </form>}
        <Link href="/login" className="mt-5 inline-block text-sm font-medium underline">Back to sign in</Link>
      </section>
    </main>
  );
}
