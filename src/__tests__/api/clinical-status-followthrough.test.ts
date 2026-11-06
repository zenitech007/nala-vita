const user = jest.fn(), lookup = jest.fn(), update = jest.fn(), care = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: () => user() }, prescription: { findUnique: (...a: unknown[]) => lookup(...a), findFirst: (...a: unknown[]) => lookup(...a), update: (...a: unknown[]) => update(...a) }, medicalNote: { findFirst: (...a: unknown[]) => lookup(...a), update: (...a: unknown[]) => update(...a) }, referral: { findFirst: (...a: unknown[]) => lookup(...a), update: (...a: unknown[]) => update(...a), updateMany: (...a: unknown[]) => update(...a) }, auditLog: { create: async () => ({}) } } }));
jest.mock('@/lib/notifications', () => ({ createNotification: async () => undefined }));
jest.mock('@/lib/access-control', () => ({ doctorHasPatientAccess: (...a: unknown[]) => care(...a) }));
import { POST as usage } from '@/app/api/medications/[id]/usage/route';
import { PATCH as privacy } from '@/app/api/medications/[id]/privacy/route';
import { PATCH as refill } from '@/app/api/medications/[id]/refill/route';
import { PATCH as notes } from '@/app/api/patients/privacy/route';
import { PATCH as referral } from '@/app/api/referrals/route';
const routes = [['usage', usage, {}], ['privacy', privacy, { isSharedWithDoctor: false }], ['refill', refill, {}], ['notes', notes, { noteId: 'r', isPrivate: true }], ['referral', referral, { referralId: 'r', action: 'ACCEPTED' }]] as const;
beforeEach(() => { jest.resetAllMocks(); lookup.mockResolvedValue({ id: 'r', patientId: 'p', status: 'PENDING', referringDoctor: { user: { id: 'from' } }, referredDoctor: { user: { id: 'to' } }, patient: { user: { id: 'p' } } }); update.mockResolvedValue({ count: 1 }); });
describe.each(routes)('F09 %s', (_, handler, body) => {
  it.each([['inactive', { role: 'PATIENT', isActive: false, patient: { id: 'p' } }], ['wrong role', { role: 'ADMIN', isActive: true, patient: { id: 'p' } }]])('denies %s before target lookup', async (_, actor) => {
    user.mockResolvedValue({ id: 'u', ...actor }); const res = await handler(new Request('http://localhost/api/test', { method: 'POST', body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: 'r' }) });
    expect(res.status).toBe(403); expect(lookup).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
});
it('F09 receiving doctor needs patient-approved care access before referral mutation', async () => {
  user.mockResolvedValue({ id: 'u', role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } }); care.mockResolvedValue(false);
  const res = await referral(new Request('http://localhost/api/referrals', { method: 'PATCH', body: JSON.stringify({ referralId: 'r', action: 'ACCEPTED' }) }) as never);
  expect(res.status).toBe(403); expect(update).not.toHaveBeenCalled();
});
