const findUser = jest.fn(), createAppointment = jest.fn(), createNote = jest.fn();
const createRequest = jest.fn();
jest.mock('@/lib/record-access-requests', () => ({ requestRecordAccess: (...args: unknown[]) => createRequest(...args), ConsentError: class extends Error {} }));
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: (...args: unknown[]) => findUser(...args), findFirst: async () => null },
  appointment: { create: (...args: unknown[]) => createAppointment(...args) }, medicalNote: { create: (...args: unknown[]) => createNote(...args) },
  patient: { findUnique: async () => ({ id: 'p', insuranceNumber: 'private-insurance', user: { email: 'synthetic@example.test' } }) },
  auditLog: { create: async () => ({}) },
} }));
import { POST } from '@/app/api/patients/route';
beforeEach(() => {
  jest.resetAllMocks();
  findUser.mockResolvedValueOnce({ id: 'doctor-user', role: 'DOCTOR', isActive: true, doctor: { id: 'new-doctor', isVerified: true } })
    .mockResolvedValueOnce({ id: 'patient-user', role: 'PATIENT', email: 'synthetic@example.test', patient: { id: 'p', createdByDoctorId: 'old-doctor' } });
  createRequest.mockResolvedValue({ id: 'request', status: 'PENDING' });
});
it('F04 matching a patient creates only a pending request, never a confirmed appointment or an initial note', async () => {
  const result = await POST(new Request('http://localhost/api/patients', { method: 'POST', body: JSON.stringify({
    firstName: 'Synthetic', lastName: 'Patient', email: 'synthetic@example.test', dateOfBirth: '1990-01-01', gender: 'other', initialNotes: 'must not write before consent',
  }) }) as never);
  expect(result.status).toBe(202); expect(createRequest).toHaveBeenCalledTimes(1);
  expect(createAppointment).not.toHaveBeenCalled(); expect(createNote).not.toHaveBeenCalled();
  const body = await result.json(); expect(body).toMatchObject({ request: { id: 'request', status: 'PENDING' } });
  expect(JSON.stringify(body)).not.toContain('private-insurance'); expect(body.patient).toBeUndefined();
});
