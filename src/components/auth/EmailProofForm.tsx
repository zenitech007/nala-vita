"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

export default function EmailProofForm({ mode }: { mode: "claim" | "verify" }) {
  const [email, setEmail] = useState(""), [invitationCode, setInvitationCode] = useState("");
  const [code, setCode] = useState(""), [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [canResend, setCanResend] = useState(false);
  useEffect(() => {
    if (!challengeId) return;
    const timer = setTimeout(() => setCanResend(true), 60000);
    return () => clearTimeout(timer);
  }, [challengeId]);
  const endpoint = mode === "claim" ? "claim" : "email";
  async function requestCode() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${endpoint}/request`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), ...(mode === "claim" && invitationCode.trim() ? { invitationCode: invitationCode.trim() } : {}) }) });
      const body = await response.json();
      if (!response.ok || typeof body.challengeId !== "string") throw new Error(body.error || "Could not request a code. Try again.");
      setCanResend(false);setChallengeId(body.challengeId); setCode(""); setMessage(body.message || "If eligible, a code will be sent to your email.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not request a code. Try again."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!challengeId) { await requestCode(); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${endpoint}/complete`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), challengeId, code, ...(mode === "claim" ? { password } : {}) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The code could not be verified. Request a new code.");
      setDone(true); setPassword(""); setCode(""); setMessage(body.message);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Verification could not finish. Your entries are still here."); }
    finally { setBusy(false); }
  }
  const field = "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";
  return <main className="min-h-screen bg-gray-50 px-4 py-12 sm:py-20">
    <section className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 sm:p-8" aria-labelledby="email-proof-title">
      <Link href="/" className="font-semibold text-[var(--primary)] focus-visible:outline focus-visible:outline-2">Nala Vita</Link>
      <h1 id="email-proof-title" className="mt-6 text-2xl font-semibold text-gray-900">{mode === "claim" ? "Claim your clinic record" : "Verify your email"}</h1>
      <p className="mt-3 text-sm leading-6 text-gray-700">{mode === "claim"
        ? "Use the email already on your clinic record. If only a phone number is on file, ask your clinic for an invitation code and verify your chosen email."
        : "Verify the email you used to register before signing in."}</p>
      {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-5 text-sm text-gray-700">{message}</p>}
      {done ? <Link href="/login" className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--primary)]">Sign in</Link>
        : <form onSubmit={submit} className="mt-6 space-y-5">
          <div><label htmlFor="proof-email" className="mb-2 block text-sm font-medium text-gray-800">Email</label>
            <input id="proof-email" type="email" autoComplete="email" required value={email} disabled={busy || !!challengeId} onChange={event => setEmail(event.target.value)} className={field} /></div>
          {mode === "claim" && !challengeId && <div><label htmlFor="proof-invitation" className="mb-2 block text-sm font-medium text-gray-800">Clinic invitation code (optional)</label>
            <input id="proof-invitation" autoComplete="off" maxLength={128} value={invitationCode} onChange={event => setInvitationCode(event.target.value)} className={field} /></div>}
          {challengeId && <><div><label htmlFor="proof-code" className="mb-2 block text-sm font-medium text-gray-800">Six-digit email code</label>
            <input id="proof-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} className={field} />
            <p className="mt-2 text-xs text-gray-600">Expires in 10 minutes. Five attempts maximum.</p></div>
            {mode === "claim" && <div><label htmlFor="proof-password" className="mb-2 block text-sm font-medium text-gray-800">Create a password</label>
              <input id="proof-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} className={field} /></div>}</>}
          <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--primary)]">{busy ? "Please wait…" : !challengeId ? "Send email code" : mode === "claim" ? "Verify and claim record" : "Verify email"}</button>
          {challengeId && <div className="flex flex-wrap gap-4 text-sm"><button type="button" disabled={busy || !canResend} onClick={requestCode} className="text-gray-800 underline disabled:text-gray-500">Send a new code{!canResend ? " (wait 60 seconds)" : ""}</button>
            <button type="button" disabled={busy} onClick={() => { setChallengeId(""); setCode(""); setPassword(""); setMessage(""); }} className="text-gray-800 underline">Change email</button></div>}
        </form>}
      <p className="mt-6 text-sm text-gray-700">Already signed up? <Link href="/login" className="underline">Sign in</Link></p>
    </section>
  </main>;
}
