"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-fetch";

interface ReviewDoctor {
  id: string;
  specialization: string;
  licenseNumber: string;
  updatedAt: string;
  isVerified: boolean;
  user: { firstName: string; lastName: string; isActive: boolean };
  verification: null | {
    status: string; reason: string | null; reviewedAt: string | null;
    reviewer: { firstName: string; lastName: string } | null;
  };
}
export default function DoctorVerificationQueue() {
  const [status, setStatus] = useState("PENDING");
  const [revision, setRevision] = useState(0);
  const key = status + ":" + revision;
  const [result, setResult] = useState<{ key: string; doctors: ReviewDoctor[]; error: string }>({ key: "", doctors: [], error: "" });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchJson<{ doctors: ReviewDoctor[] }>("/api/admin/doctors?status=" + status, { signal: controller.signal })
      .then(data => setResult({ key, doctors: data.doctors, error: "" }))
      .catch(error => {
        if (!controller.signal.aborted) setResult({ key, doctors: [], error: error instanceof Error ? error.message : "Could not load reviews." });
      });
    return () => controller.abort();
  }, [key, status]);

  async function review(doctor: ReviewDoctor, decision: "PENDING" | "VERIFIED" | "REJECTED") {
    setError("");
    setMessage("");
    setBusy(doctor.id);
    try {
      const response = await fetchJson<{ emailStatus: string }>("/api/admin/doctors/" + encodeURIComponent(doctor.id) + "/verification", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision, reason: reasons[doctor.id], expectedUpdatedAt: doctor.updatedAt }),
      });
      setMessage(response.emailStatus === "sent" ? "Decision saved. Notification email sent." : "Decision saved. Email delivery is unavailable.");
      setReasons(previous => ({ ...previous, [doctor.id]: "" }));
      setRevision(value => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the decision.");
    } finally {
      setBusy(null);
    }
  }

  return <main className="mx-auto max-w-4xl px-4 py-8">
    <h1 className="text-2xl font-semibold">Doctor verification</h1>
    <label htmlFor="review-status" className="mt-5 block text-sm font-medium">Review status</label>
    <select id="review-status" value={status} onChange={event => setStatus(event.target.value)} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2">
      <option value="PENDING">Pending</option><option value="VERIFIED">Verified</option>
      <option value="REJECTED">Rejected</option><option value="ALL">All</option>
    </select>
    {(error || result.error) && <p role="alert" className="mt-4 text-red-700">{error || result.error}</p>}
    {message && <p role="status" className="mt-4">{message}</p>}
    {result.key !== key ? <p role="status" className="mt-6">Loading reviews…</p> : !result.doctors.length ? <p className="mt-6">No doctors match this review status.</p> :
      <div className="mt-6 space-y-6">{result.doctors.map(doctor => <section key={doctor.id} className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">{doctor.user.firstName} {doctor.user.lastName}</h2>
        <p className="text-sm text-gray-600">{doctor.specialization} · License {doctor.licenseNumber}</p>
        <p className="mt-2 text-sm">Status {doctor.verification?.status ?? (doctor.isVerified ? "VERIFIED" : "PENDING")}{!doctor.user.isActive && " · Account inactive"}</p>
        {doctor.verification?.reason && <p className="mt-2 text-sm">{doctor.verification.reason}</p>}
        {doctor.verification?.reviewer && <p className="mt-2 text-sm text-gray-600">Reviewed by {doctor.verification.reviewer.firstName} {doctor.verification.reviewer.lastName}</p>}
        <label htmlFor={"review-reason-" + doctor.id} className="mt-4 block text-sm font-medium">Review reason</label>
        <textarea id={"review-reason-" + doctor.id} required minLength={3} maxLength={1000} value={reasons[doctor.id] ?? ""}
          onChange={event => setReasons(previous => ({ ...previous, [doctor.id]: event.target.value }))}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3" />
        <div className="mt-3 flex flex-wrap gap-3">
          {(["VERIFIED", "REJECTED", "PENDING"] as const).map(decision => <button key={decision} type="button"
            disabled={!!busy || (reasons[doctor.id]?.trim().length ?? 0) < 3}
            onClick={() => void review(doctor, decision)} className="brand-action rounded-lg px-4 py-2">
            {decision === "VERIFIED" ? "Approve" : decision === "REJECTED" ? "Reject" : "Return to pending"}
          </button>)}
        </div>
      </section>)}</div>}
  </main>;
}
