jest.mock('@/lib/visible-patient-record', () => ({ loadVisiblePatientRecord: (...a: unknown[]) => visible(...a) }));
const user = jest.fn(), appointment = jest.fn(), visible = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => user(...a) }, appointment: { findUnique: (...a: unknown[]) => appointment(...a) } } }));
import { GET } from '@/app/api/appointments/[id]/route';
beforeEach(() => { jest.resetAllMocks(); user.mockResolvedValue({ id: 'u', role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } }); });
it('F11 authorizes the appointment before loading any patient history', async () => {
  appointment.mockResolvedValue({ id: 'a', doctorId: 'other', patientId: 'p', patient: { medicalNotes: [{ content: 'private' }] } });
  const res = await GET(new Request('http://localhost/api/appointments/a') as never, { params: Promise.resolve({ id: 'a' }) });
  expect(res.status).toBe(403); expect(visible).not.toHaveBeenCalled();
  expect(appointment.mock.calls[0][0]).toEqual({ where: { id: 'a' }, select: { id: true, patientId: true, doctorId: true } });
});
it('F11 uses scoped clinical data even for the involved doctor', async () => {
  appointment.mockResolvedValue({ id: 'a', doctorId: 'd', patientId: 'p', patient: { medicalNotes: [{ content: 'private' }] } });
  visible.mockResolvedValue({ patient: { id: 'p' }, medicalNotes: [], vitals: [], prescriptions: [], labOrders: [] });
  const res = await GET(new Request('http://localhost/api/appointments/a') as never, { params: Promise.resolve({ id: 'a' }) });
  expect(res.status).toBe(200); expect(visible).toHaveBeenCalledWith(expect.objectContaining({ id: 'u' }), 'p');
  expect((await res.json()).appointment.patient.medicalNotes).toEqual([]);
});

