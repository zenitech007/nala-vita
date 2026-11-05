const createUser = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: async () => ({ id: 'u-doctor', role: 'DOCTOR', isActive: true, doctor: { id: 'd', isVerified: true } }), findFirst: async () => null, create: (...a: unknown[]) => createUser(...a) },
  appointment: { create: async () => ({}) }, medicalNote: { create: async () => ({}) }, auditLog: { create: async () => ({}) },
  patient: { findUnique: async () => ({ id: 'p', user: { firstName: 'Synthetic', lastName: 'Patient', email: null } }) },
} }));
import { POST } from '@/app/api/patients/route';
it('F01 clinic can create a phone-only unbound record without inventing an email or Auth UUID', async () => {
  createUser.mockResolvedValue({ patient: { id: 'p' } });
  const result = await POST(new Request('http://localhost/api/patients', { method: 'POST', body: JSON.stringify({ firstName: 'Synthetic', lastName: 'Patient', phone: '+15550000000', dateOfBirth: '1990-01-01', gender: 'other' }) }) as never);
  expect(result.status).toBe(201); expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: null, supabaseId: null }) }));
});
