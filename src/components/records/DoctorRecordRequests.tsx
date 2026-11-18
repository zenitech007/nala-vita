"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { RECORD_SCOPES, RECORD_SCOPE_LABELS } from "@/lib/record-scope";
import { consentDate, consentJson, consentPost, providerLabel, type ConsentRow } from "./consent-ui";
export default function DoctorRecordRequests({ patientId }: { patientId?: string }) {
  const [requests, setRequests] = useState<ConsentRow[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<{ id: string; user: { firstName: string; lastName: string } }[]>([]);
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]), [memberships, setMemberships] = useState<typeof facilities>([]);
  const [email, setEmail] = useState(""), [source, setSource] = useState("auto"), [requesterFacilityId, setRequesterFacilityId] = useState("");
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const load = useCallback(() => {
    return Promise.all([consentJson<{ requests: ConsentRow[]; nextCursor: string | null }>("/api/record-access"),
        consentJson<{ doctors: typeof doctors }>("/api/doctors?limit=50"), consentJson<{ requesterFacilities: typeof facilities; sourceFacilities: typeof facilities }>("/api/record-access/facilities")]).then(([r, d, f]) => {
      setError("");
      setRequests(r.requests); setCursor(r.nextCursor); setDoctors(d.doctors); setFacilities(f.sourceFacilities); setMemberships(f.requesterFacilities); setLoaded(true);
    }).catch((failure: unknown) => { setError(failure instanceof Error ? failure.message : "Could not load record requests."); });
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const sourceFields = source.startsWith("doctor:") ? { sourceDoctorId: source.slice(7) } : source.startsWith("facility:") ? { sourceFacilityId: source.slice(9) } : {};
    try {
      const result = await consentJson<{ message: string }>("/api/record-access", consentPost({ ...(patientId ? { patientId } : { patientEmail: email.trim() }), scope: [...RECORD_SCOPES],
        requesterFacilityId: requesterFacilityId || undefined, ...sourceFields }));
      setMessage(result.message); setEmail(""); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not request records. Your draft is still here."); }
    finally { setBusy(false); }
  }
  async function more() {
    if (!cursor) return; setBusy(true); setError("");
    try { const result = await consentJson<{ requests: ConsentRow[]; nextCursor: string | null }>(`/api/record-access?cursor=${encodeURIComponent(cursor)}`); setRequests(current => [...current, ...result.requests]); setCursor(result.nextCursor); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load the next page."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
    <header><Link href="/doctor/patients" className="text-sm text-gray-700 underline">Patients</Link><h1 className="mt-3 text-2xl font-semibold text-gray-900">Record access requests</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-700">Ask the patient to approve access to a specific source. The patient chooses record types and duration, then verifies an email code. A request does not create an appointment or grant access.</p></header>
    {error && <p role="alert" className="text-sm text-red-700">{error} <button onClick={load} className="underline">Retry loading</button></p>}
    {message && <p role="status" className="text-sm text-gray-800">{message}</p>}
    {!loaded && !error && <p role="status" className="text-sm text-gray-700">Loading requests…</p>}
    {loaded && <><section aria-labelledby="new-record-request" className="rounded-2xl border border-gray-200 bg-white p-5"><h2 id="new-record-request" className="text-lg font-semibold text-gray-900">Request records</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">{patientId ? <p className="text-sm text-gray-700">Requesting access for the selected patient. Their records remain private until approval.</p> : <div><label htmlFor="request-patient-email" className="mb-2 block text-sm text-gray-800">Patient email on file</label>
        <input id="request-patient-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-900" /></div>}
        <div><label htmlFor="request-source" className="mb-2 block text-sm text-gray-800">Record source</label><select id="request-source" value={source} onChange={event => setSource(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900">
          <option value="auto">Original clinic, or the patient&apos;s entered records</option>{doctors.map(doctor => <option key={doctor.id} value={`doctor:${doctor.id}`}>Dr. {doctor.user.firstName} {doctor.user.lastName}</option>)}
          {facilities.map(facility => <option key={facility.id} value={`facility:${facility.id}`}>{facility.name}</option>)}</select></div>
        {!!memberships.length && <div><label htmlFor="request-as" className="mb-2 block text-sm text-gray-800">Requesting provider</label><select id="request-as" value={requesterFacilityId} onChange={event => setRequesterFacilityId(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900"><option value="">You, as an individual clinician</option>{memberships.map(facility => <option key={facility.id} value={facility.id}>{facility.name} — active verified clinicians</option>)}</select></div>}
        <button disabled={busy || (!patientId && !email.trim())} className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : "Request patient approval"}</button>
      </form></section>
      <section aria-labelledby="record-request-status"><h2 id="record-request-status" className="text-lg font-semibold text-gray-900">Request status</h2>
        {!requests.length && <p className="mt-4 text-sm text-gray-700">No record access requests yet.</p>}
        <div className="divide-y divide-gray-200">{requests.map(request => <article key={request.id} className="space-y-2 py-5"><h3 className="font-medium text-gray-900">{request.patient?.user.firstName} {request.patient?.user.lastName}</h3>
          <p className="text-sm text-gray-700">Source: {request.sourcePending ? "awaiting patient approval" : providerLabel(request, true)} · Requested for {providerLabel(request)}</p><p className="text-sm text-gray-700">{request.scope.map(type => RECORD_SCOPE_LABELS[type]).join(", ")}</p>
          {request.reason && <p className="text-sm text-gray-700">Reason: {request.reason}</p>}
          <p className="text-sm text-gray-700">{request.effectiveStatus.toLowerCase()} · Expires {consentDate(request.expiresAt)}</p>
          {request.effectiveStatus === "APPROVED" && request.patient && <Link href={`/doctor/patients/${request.patient.id}`} className="inline-block text-sm text-gray-900 underline">Open scoped patient record</Link>}
          {request.effectiveStatus === "PENDING" && <p className="text-sm text-gray-600">Awaiting the patient&apos;s verified approval. No access granted.</p>}</article>)}</div>
        {cursor && <button disabled={busy} onClick={more} className="mt-4 text-sm text-gray-900 underline">Load more requests</button>}</section></>}
  </main>;
}
