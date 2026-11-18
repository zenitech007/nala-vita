const user = jest.fn(), target = jest.fn(), create = jest.fn(), care = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/access-control', () => ({ doctorHasPatientAccess: (...a: unknown[]) => care(...a) }));
jest.mock('@/lib/amelia/medsafety', () => ({ checkNewPrescriptionSafety: async () => undefined }));
jest.mock('@/lib/notifications', () => ({ createNotification: async () => undefined }));
jest.mock('@/lib/prisma', () => { const tx = { prescription: { create: (...a: unknown[]) => create(...a) }, labOrder: { create: (...a: unknown[]) => create(...a) }, notification: { create: async () => ({}) } }; return { prisma: {
  ...tx, user: { findUnique: () => user() }, patient: { findUnique: (...a: unknown[]) => target(...a) }, doctor: { findUnique: async () => ({ id: 'receiver', isVerified: true, user: { id: 'receiver-user', isActive: true } }) },
  medicalNote: { create: (...a: unknown[]) => create(...a) }, referral: { create: (...a: unknown[]) => create(...a) }, auditLog: { create: async () => ({}) }, $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
} }; });
import { POST as prescription } from '@/app/api/prescriptions/route';
import { POST as medication } from '@/app/api/medications/route';
import { POST as lab } from '@/app/api/lab-tests/route';
import { POST as note } from '@/app/api/patients/[id]/notes/route';
import { POST as referral } from '@/app/api/referrals/route';
const routes = [ ['prescription', prescription, { medication: 'A', dosage: '1', frequency: 'daily', duration: '1 day' }], ['medication', medication, { medication: 'A', dosage: '1', frequency: 'daily', duration: '1 day' }], ['lab', lab, { testName: 'Test' }], ['note', note, { title: 'T', content: 'C' }], ['referral', referral, { referredDoctorId: 'receiver', reason: 'R' }] ] as const;
beforeEach(() => { jest.resetAllMocks(); care.mockResolvedValue(true); target.mockResolvedValue({ id: 'p', userId: 'patient-user', user: { id: 'patient-user' } }); create.mockResolvedValue({ id: 'record' }); });
describe.each(routes)('F08 %s', (_, handler, body) => {
  const call = () => handler(new Request('http://localhost/api/test', { method: 'POST', body: JSON.stringify({ ...body, patientId: 'p', authoredByDoctorId: 'forged' }) }) as never, { params: Promise.resolve({ id: 'p' }) });
  it.each([['inactive', { role: 'DOCTOR', isActive: false, doctor: { id: 'd', isVerified: true } }], ['unverified', { role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: false } }], ['wrong role', { role: 'ADMIN', isActive: true, doctor: { id: 'd', isVerified: true } }], ['missing profile', { role: 'DOCTOR', isActive: true }]])('denies %s before target read/write', async (_, actor) => { user.mockResolvedValue({ id: 'u', ...actor }); expect((await call()).status).toBe(403); expect(target).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); });
  it('denies unrelated target before reading patient details', async () => { user.mockResolvedValue({ id: 'u', role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } }); care.mockResolvedValue(false); expect((await call()).status).toBe(403); expect(target).not.toHaveBeenCalled(); });
  it('records authenticated authorship for a permitted target', async () => { user.mockResolvedValue({ id: 'u', role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } }); expect((await call()).status).toBe(201); expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patientId: 'p', authoredByDoctorId: 'd', authoredByUserId: 'u' }) })); });
});
