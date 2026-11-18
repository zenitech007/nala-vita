const authUser = jest.fn(), findUser = jest.fn();
const requestAccess = jest.fn(), requestOtp = jest.fn(), approve = jest.fn(), deny = jest.fn(), revoke = jest.fn();
const listRequests = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: (...a: unknown[]) => authUser(...a) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUser(...a) },
  facilityMembership: { findMany: async () => [] }, recordAccessRequest: { findMany: (...a: unknown[]) => listRequests(...a) },
} }));
jest.mock('@/lib/record-access-requests', () => {
  const actual = jest.requireActual('@/lib/record-access-requests');
  return { ...actual, requestRecordAccess: (...a: unknown[]) => requestAccess(...a), requestApprovalOtp: (...a: unknown[]) => requestOtp(...a),
    approveRecordAccess: (...a: unknown[]) => approve(...a), denyRecordAccess: (...a: unknown[]) => deny(...a), revokeRecordAccess: (...a: unknown[]) => revoke(...a) };
});
import { POST as otpRoute } from '@/app/api/record-access/[id]/otp/route';
import { POST as approveRoute } from '@/app/api/record-access/[id]/approve/route';
import { POST as denyRoute } from '@/app/api/record-access/[id]/deny/route';
import { POST as revokeRoute } from '@/app/api/record-access/grants/[id]/revoke/route';
import { GET as listRoute } from '@/app/api/record-access/route';
const params = { params: Promise.resolve({ id: 'target' }) };
const body = { scope: ['VITALS'], durationDays: 7, challengeId: '11111111-1111-4111-8111-111111111111', code: '123456', patientId: 'victim' };
const req = () => new Request('http://localhost/api/record-access', { method: 'POST', body: JSON.stringify(body) }) as never;
const patient = { id: 'u', role: 'PATIENT', isActive: true, email: 'synthetic@example.test', emailVerified: true, patient: { id: 'own' }, doctor: null };
beforeEach(() => { jest.resetAllMocks(); authUser.mockResolvedValue({ data: { user: { id: 'auth', email: patient.email, email_confirmed_at: '2026-01-01' } } });
  findUser.mockResolvedValue(patient); requestOtp.mockResolvedValue({ challengeId: body.challengeId }); approve.mockResolvedValue({ id: 'grant' }); });
it.each([
  ['anonymous', null, 401], ['inactive patient', { ...patient, isActive: false }, 403],
  ['doctor', { ...patient, role: 'DOCTOR', patient: null, doctor: { id: 'd', isVerified: true } }, 403],
  ['unverified doctor', { ...patient, role: 'DOCTOR', patient: null, doctor: { id: 'd', isVerified: false } }, 403],
  ['admin', { ...patient, role: 'ADMIN', patient: null }, 403], ['missing patient profile', { ...patient, patient: null }, 403],
])('F04 role/status matrix rejects %s before consent mutations', async (_label, user, status) => {
  if (!user) authUser.mockResolvedValue({ data: { user: null } }); else findUser.mockResolvedValue(user);
  for (const route of [otpRoute, approveRoute, denyRoute, revokeRoute]) expect((await route(req(), params)).status).toBe(status);
  expect(requestOtp).not.toHaveBeenCalled(); expect(approve).not.toHaveBeenCalled(); expect(deny).not.toHaveBeenCalled(); expect(revoke).not.toHaveBeenCalled();
});
it('F04 current verified contact is required for approval, and patient target is derived from the authenticated profile', async () => {
  expect((await otpRoute(req(), params)).status).toBe(202); expect((await approveRoute(req(), params)).status).toBe(200);
  expect(approve).toHaveBeenCalledWith(expect.objectContaining({ patient: { id: 'own' } }), 'target', expect.anything(), expect.anything());
  authUser.mockResolvedValue({ data: { user: { id: 'auth', email: 'changed@example.test', email_confirmed_at: '2026-01-01' } } });
  expect((await approveRoute(req(), params)).status).toBe(403);
});
it('F04 pending clinician status does not disclose the existing source provider or clinical request text', async () => {
  findUser.mockResolvedValue({ ...patient, role: 'DOCTOR', patient: null, doctor: { id: 'd', isVerified: true } });
  listRequests.mockResolvedValue([{ id: 'request', status: 'PENDING', scope: ['VITALS'], expiresAt: new Date('2030-01-01'), grant: null,
    sourceDoctorId: 'private-source', sourceDoctor: { user: { firstName: 'Private', lastName: 'Source' } }, reason: 'private request text' }]);
  const response = await listRoute(new Request('http://localhost/api/record-access') as never);
  expect(response.status).toBe(200); const text = JSON.stringify(await response.json());
  expect(text).not.toContain('private-source'); expect(text).not.toContain('Private'); expect(text).not.toContain('private request text');
});
