import type { ClinicalScope } from "@/lib/record-scope";
interface Person { firstName: string; lastName: string; role?: string; isActive?: boolean }
export interface ProviderRow {
  requesterDoctor?: { id: string; isVerified?: boolean; user: Person } | null;
  requesterFacility?: { id: string; name: string; isActive?: boolean } | null;
  sourceDoctor?: { id: string; user: Person } | null;
  sourceFacility?: { id: string; name: string } | null;
  sourceUserId?: string | null;
}
export interface ConsentRow extends ProviderRow {
  sourcePending?: boolean;
  reason?: string | null;
  id: string; scope: ClinicalScope[]; effectiveStatus: string; expiresAt: string;
  requestedBy?: Person; patient?: { id: string; user: Person };
}
export interface RecordSource { key: string; label: string; sourceDoctorId?: string; sourceFacilityId?: string; sourceUserId?: string }
export interface AccessLogRow { id: string; viewerUser: Person; viewerFacility?: { name: string } | null; recordType: string; viewedAt: string }
export function providerLabel(row: ProviderRow, source = false) {
  const doctor = source ? row.sourceDoctor : row.requesterDoctor;
  const facility = source ? row.sourceFacility : row.requesterFacility;
  if (facility) return facility.name;
  if (doctor) return `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`;
  return source && row.sourceUserId ? "Your entered records and profile" : "Provider unavailable";
}
export async function consentJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}). Try again.`);
  return body as T;
}
export const consentPost = (body?: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
export const consentDate = (value: string) => new Date(value).toLocaleString();
