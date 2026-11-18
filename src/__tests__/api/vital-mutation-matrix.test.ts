const user = jest.fn(), create = jest.fn(), care = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: () => user() }, patient: { findUnique: async () => ({ userId: 'patient-user' }) }, vital: { create: (...args: unknown[]) => create(...args) } } }));
jest.mock('@/lib/access-control', () => ({ doctorHasPatientAccess: (...args: unknown[]) => care(...args) }));
import { POST } from '@/app/api/vitals/route';
const submit = () => POST(new Request('http://localhost/api/vitals', { method: 'POST', body: JSON.stringify({ patientId: 'target', heartRate: 80, authoredByDoctorId: 'forged' }) }) as never);
beforeEach(() => { jest.resetAllMocks(); care.mockResolvedValue(false); create.mockImplementation(async ({ data }) => ({ id: 'v', ...data })); });
it.each([
  ['inactive patient', { role: 'PATIENT', isActive: false, patient: { id: 'own' } }],
  ['admin with patient profile', { role: 'ADMIN', isActive: true, patient: { id: 'own' } }],
  ['pending doctor', { role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: false } }],
  ['inactive doctor', { role: 'DOCTOR', isActive: false, doctor: { id: 'd', isVerified: true } }],
  ['unrelated doctor', { role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } }],
])('F07 rejects %s before vital writes', async (_, actor) => { user.mockResolvedValue({ id: 'u', ...actor }); expect((await submit()).status).toBe(403); expect(create).not.toHaveBeenCalled(); });
it('F07 patient writes derive target and authorship from identity', async () => {
  user.mockResolvedValue({ id: 'u', role: 'PATIENT', isActive: true, patient: { id: 'own' } });
  expect((await submit()).status).toBe(201); expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patientId: 'own', authoredByUserId: 'u', authoredByDoctorId: null }) }));
});
it('F07 verified doctor writes own authorship only after target check', async () => {
  care.mockResolvedValue(true); user.mockResolvedValue({ id: 'u', role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } });
  expect((await submit()).status).toBe(201); expect(care).toHaveBeenCalledWith('d', 'target');
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patientId: 'target', authoredByDoctorId: 'd', authoredByUserId: 'u' }) }));
});
