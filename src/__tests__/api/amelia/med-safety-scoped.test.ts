const user = jest.fn(), legacyRead = jest.fn(), visible = jest.fn(), analyze = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: () => user() }, patient: { findUnique: () => legacyRead() } } }));
jest.mock('@/lib/access-control', () => ({ doctorHasPatientAccess: async () => true }));
jest.mock('@/lib/visible-patient-record', () => ({ loadVisiblePatientRecord: (...args: unknown[]) => visible(...args) }));
jest.mock('@/lib/rate-limit', () => ({ checkRateLimitAsync: async () => ({ allowed: true }) }));
jest.mock('@/lib/amelia/medsafety', () => ({ analyzeMedications: (...args: unknown[]) => analyze(...args), getCachedOrAnalyze: (...args: unknown[]) => analyze(...args) }));
import { GET, POST } from '@/app/api/amelia/med-safety/route';
beforeEach(() => { jest.resetAllMocks(); analyze.mockResolvedValue({}); visible.mockResolvedValue({ patient: { allergies: [] }, prescriptions: [{ medication: 'Visible', dosage: '1', isActive: true }], profileAvailable: true, accessLimited: true }); });
it('F06 inactive patients cannot read cached safety reports', async () => {
  user.mockResolvedValue({ id: 'u', role: 'PATIENT', isActive: false, patient: { id: 'p', prescriptions: [], allergies: [] } });
  expect((await GET()).status).toBe(403);
  expect(analyze).not.toHaveBeenCalled();
});
it('F06 doctor safety input is restricted to visible records', async () => {
  user.mockResolvedValue({ id: 'u', role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } });
  legacyRead.mockResolvedValue({ allergies: ['hidden'], prescriptions: [{ medication: 'Hidden', dosage: '2' }] });
  const response = await POST(new Request('http://localhost/api/amelia/med-safety', { method: 'POST', body: JSON.stringify({ patientId: 'p' }) }) as never);
  expect(response.status).toBe(200); expect(legacyRead).not.toHaveBeenCalled();
  expect(analyze).toHaveBeenCalledWith([{ medication: 'Visible', dosage: '1' }], []);
  expect(await response.json()).toMatchObject({ accessLimited: true });
});
