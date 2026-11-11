"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RECORD_SCOPE_LABELS, RECORD_SCOPES, type ClinicalScope } from "@/lib/record-scope";
import { consentDate, consentJson, consentPost, providerLabel, type AccessLogRow, type ConsentRow, type RecordSource } from "./consent-ui";

function ApprovalRequest({ request, refresh }: { request: ConsentRow; refresh: () => Promise<void> }) {
  const [scope, setScope] = useState<ClinicalScope[]>(request.scope), [days, setDays] = useState(30);
  const [challengeId, setChallengeId] = useState(""), [code, setCode] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [canResend, setCanResend] = useState(false);
  useEffect(() => { if (!challengeId) return; setCanResend(false); const timer = setTimeout(() => setCanResend(true), 60000); return () => clearTimeout(timer); }, [challengeId]);
  async function sendCode() {
    setBusy(true); setError("");
    try {
      const result = await consentJson<{ challengeId: string; message: string }>(`/api/record-access/${request.id}/otp`, consentPost({ scope, durationDays: days }));
      setChallengeId(result.challengeId); setCode(""); setMessage(result.message);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not request a code."); }
    finally { setBusy(false); }
  }
  async function act(action: "approve" | "deny") {
    setBusy(true); setError("");
    try {
      await consentJson(`/api/record-access/${request.id}/${action}`, consentPost(action === "approve" ? { scope, durationDays: days, challengeId, code } : undefined));
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your decision. Your choices are still here."); }
    finally { setBusy(false); }
  }
  return <article className="space-y-4 border-b border-gray-200 py-6 last:border-0" aria-labelledby={`request-${request.id}`}>
    <div><h3 id={`request-${request.id}`} className="font-semibold text-gray-900">{providerLabel(request)} requests access</h3>
      <p className="mt-1 text-sm text-gray-700">Source: {providerLabel(request, true)}. {request.requesterFacility ? "Access covers active, verified clinicians at this facility." : "Access is for this clinician."}</p>
      {request.requestedBy?.role === "DOCTOR" && <p className="mt-1 text-sm text-gray-600">Requested by Dr. {request.requestedBy.firstName} {request.requestedBy.lastName}</p>}</div>
    {request.reason && <p className="text-sm text-gray-700">Reason: {request.reason}</p>}
    <fieldset disabled={busy || !!challengeId} className="space-y-2"><legend className="mb-2 text-sm font-medium text-gray-900">Choose what they may read</legend>
      {request.scope.map(type => <label key={type} className="flex items-center gap-3 text-sm text-gray-800"><input type="checkbox" checked={scope.includes(type)}
        onChange={event => setScope(current => event.target.checked ? [...current, type] : current.filter(value => value !== type))} />{RECORD_SCOPE_LABELS[type]}</label>)}</fieldset>
    <div><label htmlFor={`duration-${request.id}`} className="mr-3 text-sm font-medium text-gray-900">Access duration</label>
      <select id={`duration-${request.id}`} disabled={busy || !!challengeId} value={days} onChange={event => setDays(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900">
        {[1, 7, 30, 90, 365].map(value => <option key={value} value={value}>{value} {value === 1 ? "day" : "days"}</option>)}</select></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
    {challengeId && <div><label htmlFor={`code-${request.id}`} className="mb-2 block text-sm font-medium text-gray-900">Six-digit email code</label>
      <input id={`code-${request.id}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-gray-900" /></div>}
    <div className="flex flex-wrap gap-3">
      {!challengeId ? <button disabled={busy || !scope.length} onClick={sendCode} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : "Email code to approve"}</button>
        : <><button disabled={busy || code.length !== 6} onClick={() => act("approve")} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve selected access</button>
          <button disabled={busy || !canResend} onClick={sendCode} className="text-sm text-gray-800 underline disabled:text-gray-500">Send new code{!canResend ? " (wait 60 seconds)" : ""}</button>
          <button disabled={busy} onClick={() => { setChallengeId(""); setCode(""); setMessage(""); }} className="text-sm text-gray-800 underline">Change scope</button></>}
      <button disabled={busy} onClick={() => act("deny")} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 disabled:opacity-50">Deny request</button>
    </div>
  </article>;
}

export default function PatientRecordAccess() {
  const [requests, setRequests] = useState<ConsentRow[]>([]), [grants, setGrants] = useState<ConsentRow[]>([]), [sources, setSources] = useState<RecordSource[]>([]);
  const [logs, setLogs] = useState<AccessLogRow[]>([]), [doctors, setDoctors] = useState<{ id: string; user: { firstName: string; lastName: string } }[]>([]);
  const [requestCursor, setRequestCursor] = useState<string | null>(null), [logCursor, setLogCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(""), [sourceKey, setSourceKey] = useState(""), [doctorId, setDoctorId] = useState("");
  const [unclassified, setUnclassified] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const [r, g, s, l, d] = await Promise.all([
        consentJson<{ requests: ConsentRow[]; nextCursor: string | null }>("/api/record-access"),
        consentJson<{ grants: ConsentRow[] }>("/api/record-access/grants"), consentJson<{ sources: RecordSource[]; hasUnclassifiedRecords: boolean }>("/api/record-access/sources"),
        consentJson<{ logs: AccessLogRow[]; nextCursor: string | null }>("/api/record-access/log"), consentJson<{ doctors: typeof doctors }>("/api/doctors?limit=50"),
      ]);
      setRequests(r.requests); setRequestCursor(r.nextCursor); setGrants(g.grants); setSources(s.sources); setUnclassified(s.hasUnclassifiedRecords);
      setLogs(l.logs); setLogCursor(l.nextCursor); setDoctors(d.doctors); setLoaded(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Records access could not be loaded."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function revoke(id: string) {
    setBusy(id); setError("");
    try {
      const response = await consentJson<{ message: string }>(`/api/record-access/grants/${id}/revoke`, consentPost());
      setGrants(current => current.map(grant => grant.id === id ? { ...grant, effectiveStatus: "REVOKED" } : grant)); setMessage(response.message); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not revoke access. Try again."); }
    finally { setBusy(""); }
  }
  async function prepareShare() {
    const source = sources.find(item => item.key === sourceKey); if (!source || !doctorId) return;
    setBusy("share"); setError("");
    try {
      const result = await consentJson<{ message: string }>("/api/patients/share", consentPost({ doctorId, sourceDoctorId: source.sourceDoctorId, sourceFacilityId: source.sourceFacilityId, sourceUserId: source.sourceUserId, scope: [...RECORD_SCOPES] }));
      setMessage(result.message); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not prepare a request. Your choices are still here."); }
    finally { setBusy(""); }
  }
  async function loadMore(kind: "requests" | "logs") {
    const cursor = kind === "requests" ? requestCursor : logCursor; if (!cursor) return;
    setBusy(kind); setError("");
    try {
      if (kind === "requests") { const result = await consentJson<{ requests: ConsentRow[]; nextCursor: string | null }>(`/api/record-access?cursor=${encodeURIComponent(cursor)}`); setRequests(current => [...current, ...result.requests]); setRequestCursor(result.nextCursor); }
      else { const result = await consentJson<{ logs: AccessLogRow[]; nextCursor: string | null }>(`/api/record-access/log?cursor=${encodeURIComponent(cursor)}`); setLogs(current => [...current, ...result.logs]); setLogCursor(result.nextCursor); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load the next page."); }
    finally { setBusy(""); }
  }
  return <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
    <header><Link href="/patient/records" className="text-sm text-gray-700 underline">Medical records</Link><h1 className="mt-3 text-2xl font-semibold text-gray-900">Who has access</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-700">You choose the source, record types and duration. Providers keep records they authored. Revoking a grant stops future access through it; data already viewed or copied cannot be recalled.</p>
      <p className="mt-2 text-sm text-gray-700">Approval requires an email code. <Link href="/verify-email" className="underline">Verify your email</Link> if needed.</p></header>
    {error && <div role="alert" className="text-sm text-red-700">{error} <button onClick={load} className="underline">Retry loading</button></div>}
    {message && <p role="status" className="text-sm text-gray-800">{message}</p>}
    {!loaded && !error && <p role="status" className="text-gray-700">Loading access information…</p>}
    {loaded && <>
      <section aria-labelledby="pending-access" className="rounded-2xl border border-gray-200 bg-white px-5 py-4"><h2 id="pending-access" className="text-lg font-semibold text-gray-900">Pending approvals</h2>
        {requests.length ? requests.map(request => <ApprovalRequest key={request.id} request={request} refresh={load} />) : <p className="py-4 text-sm text-gray-700">No requests awaiting your approval.</p>}
        {requestCursor && <button disabled={!!busy} onClick={() => loadMore("requests")} className="py-3 text-sm underline">Load more requests</button>}</section>
      <section aria-labelledby="granted-access" className="rounded-2xl border border-gray-200 bg-white p-5"><h2 id="granted-access" className="text-lg font-semibold text-gray-900">Copy and view grants</h2>
        {!grants.length && <p className="mt-4 text-sm text-gray-700">You have not approved any grants.</p>}
        {grants.map(grant => <article key={grant.id} className="space-y-2 border-b border-gray-200 py-5 last:border-0"><h3 className="font-medium text-gray-900">{providerLabel(grant)}</h3>
          <p className="text-sm text-gray-700">Source: {providerLabel(grant, true)}</p><p className="text-sm text-gray-700">{grant.scope.map(type => RECORD_SCOPE_LABELS[type]).join(", ")}</p>
          <p className="text-sm text-gray-700">{grant.effectiveStatus.toLowerCase()} · Expires {consentDate(grant.expiresAt)}</p>
          {grant.effectiveStatus === "APPROVED" && <button disabled={busy === grant.id} onClick={() => revoke(grant.id)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-800 disabled:opacity-50">Revoke access</button>}</article>)}</section>
      <section aria-labelledby="retained-sources"><h2 id="retained-sources" className="text-lg font-semibold text-gray-900">Providers retain their authored records</h2>
        <p className="mt-2 text-sm text-gray-700">Revoking a sharing grant does not remove the originating provider&apos;s own records.</p>
        <ul className="mt-3 space-y-2 text-sm text-gray-800">{sources.filter(source => !source.sourceUserId).map(source => <li key={source.key}>{source.label} — own authored records</li>)}</ul>
        {unclassified && <p className="mt-3 text-sm text-gray-700">Some older records need clinic review before they can be shared with another provider.</p>}</section>
      <section aria-labelledby="prepare-access" className="rounded-2xl border border-gray-200 bg-white p-5"><h2 id="prepare-access" className="text-lg font-semibold text-gray-900">Prepare a sharing request</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label htmlFor="access-source" className="mb-2 block text-sm text-gray-800">Record source</label><select id="access-source" value={sourceKey} onChange={event => setSourceKey(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm"><option value="">Choose a source</option>{sources.map(source => <option key={source.key} value={source.key}>{source.label}</option>)}</select></div>
          <div><label htmlFor="access-doctor" className="mb-2 block text-sm text-gray-800">Receiving clinician</label><select id="access-doctor" value={doctorId} onChange={event => setDoctorId(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm"><option value="">Choose a clinician</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>Dr. {doctor.user.firstName} {doctor.user.lastName}</option>)}</select></div></div>
        <p className="mt-3 text-sm text-gray-700">This prepares a request. Nothing is shared until you choose a scope and verify the approval code. If your clinician is not listed, ask them to send a request.</p>
        <button disabled={!!busy || !sourceKey || !doctorId} onClick={prepareShare} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Prepare request</button></section>
      <section aria-labelledby="access-log"><h2 id="access-log" className="text-lg font-semibold text-gray-900">Access log</h2><p className="mt-2 text-sm text-gray-700">Clinician record reads and your revocations, newest first.</p>
        {!logs.length && <p className="mt-4 text-sm text-gray-700">No access events recorded yet.</p>}
        <ul className="mt-4 divide-y divide-gray-200">{logs.map(log => <li key={log.id} className="py-3 text-sm text-gray-800"><p>{log.viewerUser.role === "PATIENT" ? "You" : `${log.viewerUser.firstName} ${log.viewerUser.lastName}`}{log.viewerFacility ? ` · ${log.viewerFacility.name}` : ""}</p>
          <p className="mt-1 text-gray-700">{log.recordType === "ACCESS_REVOKED" ? "Access revoked" : RECORD_SCOPE_LABELS[log.recordType as ClinicalScope] ?? "Lab result"} · {consentDate(log.viewedAt)}</p></li>)}</ul>
        {logCursor && <button disabled={!!busy} onClick={() => loadMore("logs")} className="mt-3 text-sm underline">Load older events</button>}</section>
    </>}
  </main>;
}
