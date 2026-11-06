const issue = jest.fn(), createGrant = jest.fn(), notify = jest.fn();
let request: any, grants: any[], validProof = true, providerActive = true;
const findRequest = async ({ where }: any) => request && where.patientId === request.patientId && request.status === where.status ? { ...request } : null;
const tx = {
  recordAccessRequest: { findFirst: findRequest, updateMany: async ({ where, data }: any) => {
    if (!request || request.id !== where.id || request.patientId !== where.patientId || request.status !== where.status) return { count: 0 };
    Object.assign(request, data); return { count: 1 };
  } },
  doctor: { findUnique: async () => ({ id: 'new-doctor', userId: 'doctor-user', isVerified: true, user: { role: 'DOCTOR', isActive: providerActive } }) },
  facilityMembership: { findFirst: async () => null },
  recordAccessGrant: { create: (...args: unknown[]) => createGrant(...args), findFirst: async ({ where }: any) => grants.find(grant => grant.id === where.id && grant.patientId === where.patientId && grant.status === where.status) ?? null,
    updateMany: async ({ where, data }: any) => { const grant = grants.find(grant => grant.id === where.id && grant.patientId === where.patientId && grant.status === where.status && !grant.revokedAt);
      if (!grant) return { count: 0 }; Object.assign(grant, data); return { count: 1 }; } },
  notification: { create: notify }, recordAccessLog: { create: async () => ({}) },
};
jest.mock('@/lib/prisma', () => ({ prisma: { recordAccessRequest: { findFirst: findRequest, updateMany: (...args: [any]) => tx.recordAccessRequest.updateMany(...args) },
  $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } }));
const consume = jest.fn();
jest.mock('@/lib/email-otp', () => ({ issueEmailOtp: (...args: unknown[]) => issue(...args), consumeEmailOtp: (...args: unknown[]) => consume(...args) }));
jest.mock('@/lib/otp-channel', () => ({ sendAppEmail: async () => undefined }));
import { requestApprovalOtp, approveRecordAccess, revokeRecordAccess, denyRecordAccess } from '@/lib/record-access-requests';
const viewer = { id: 'patient-user', role: 'PATIENT', isActive: true, email: 'synthetic@example.test', emailVerified: true, patient: { id: 'p' } };
const choice = { scope: ['PRESCRIPTIONS'], durationDays: 7 };
const proof = { challengeId: 'challenge', code: '123456', ip: '203.0.113.1' };
beforeEach(() => {
  jest.resetAllMocks(); grants = []; validProof = true; providerActive = true;
  request = { id: 'request', patientId: 'p', requestedByUserId: 'doctor-user', requesterDoctorId: 'new-doctor', requesterFacilityId: null,
    sourceDoctorId: 'old-doctor', sourceFacilityId: null, sourceUserId: null, status: 'PENDING', scope: ['PRESCRIPTIONS', 'VITALS'], expiresAt: new Date(Date.now() + 3600000) };
  issue.mockResolvedValue({ challengeId: 'challenge' });
  consume.mockImplementation(async (_proof, action) => validProof ? action(tx, { targetUserId: 'patient-user' }) : false);
  createGrant.mockImplementation(async ({ data }) => { const grant = { ...data, id: 'grant', revokedAt: null }; grants.push(grant); return grant; });
});
it('F04 binds OTP purpose to request, selected scope and duration', async () => {
  await requestApprovalOtp(viewer, 'request', choice, proof.ip);
  expect(issue).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'RECORD_ACCESS_APPROVAL', targetUserId: 'patient-user',
    binding: JSON.stringify({ requestId: 'request', scope: ['PRESCRIPTIONS'], durationDays: 7 }) }));
});
it('F04 invalid OTP creates no grant or approval', async () => {
  validProof = false; await expect(approveRecordAccess(viewer, 'request', choice, proof)).rejects.toThrow();
  expect(createGrant).not.toHaveBeenCalled(); expect(request.status).toBe('PENDING');
});
it('F04 approved scope copies source/requester identity from the stored request, not client data', async () => {
  await approveRecordAccess(viewer, 'request', { ...choice, requesterDoctorId: 'attacker', sourceDoctorId: 'another' }, proof);
  expect(grants[0]).toMatchObject({ patientId: 'p', requesterDoctorId: 'new-doctor', sourceDoctorId: 'old-doctor', scope: ['PRESCRIPTIONS'], status: 'APPROVED' });
  expect(grants[0].expiresAt.getTime() - grants[0].approvedAt.getTime()).toBe(7 * 86400000);
});
it('F04 cannot approve an unrequested record type or another patient target', async () => {
  await expect(requestApprovalOtp(viewer, 'request', { scope: ['NOTES'], durationDays: 7 }, proof.ip)).rejects.toThrow();
  await expect(approveRecordAccess({ ...viewer, patient: { id: 'other' } }, 'request', choice, proof)).rejects.toThrow();
  expect(createGrant).not.toHaveBeenCalled();
});
it('F04 inactive receiving provider cannot gain a grant', async () => {
  providerActive = false; await expect(approveRecordAccess(viewer, 'request', choice, proof)).rejects.toThrow(); expect(grants).toHaveLength(0);
});
it('F04 conditional status update admits one concurrent approval', async () => {
  const results = await Promise.allSettled([approveRecordAccess(viewer, 'request', choice, proof), approveRecordAccess(viewer, 'request', choice, proof)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(grants).toHaveLength(1);
});
it('F04 patient can deny only their own pending request', async () => {
  await expect(denyRecordAccess({ ...viewer, patient: { id: 'other' } }, 'request')).rejects.toThrow();
  await denyRecordAccess(viewer, 'request'); expect(request.status).toBe('DENIED'); expect(grants).toHaveLength(0);
});
it('F04 revocation is conditional, patient-owned and preserves the original records', async () => {
  await approveRecordAccess(viewer, 'request', choice, proof);
  await expect(revokeRecordAccess({ ...viewer, patient: { id: 'other' } }, 'grant')).rejects.toThrow();
  await revokeRecordAccess(viewer, 'grant'); expect(grants[0].status).toBe('REVOKED'); expect(grants[0].revokedAt).toEqual(expect.any(Date));
  expect(request.status).toBe('REVOKED'); expect(grants[0].sourceDoctorId).toBe('old-doctor');
});
