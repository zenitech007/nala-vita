const user = jest.fn(), target = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth' } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: () => user() }, appointment: { findUnique: (...a: unknown[]) => target(...a) } } }));
import { PATCH, DELETE } from '@/app/api/appointments/[id]/route';
it.each([PATCH, DELETE])('F09 rejects inactive clinician before appointment read', async handler => {
  user.mockResolvedValue({ id: 'u', role: 'DOCTOR', isActive: false, doctor: { id: 'd', isVerified: true } }); target.mockReset();
  const res = await handler(new Request('http://localhost/api/appointments/a', { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }) }) as never, { params: Promise.resolve({ id: 'a' }) });
  expect(res.status).toBe(403); expect(target).not.toHaveBeenCalled();
});
