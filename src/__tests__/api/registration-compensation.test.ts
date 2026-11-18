const createAuth = jest.fn(), deleteAuth = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: async () => null, create: async () => { throw new Error('synthetic DB failure'); } } } }));
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { auth: { admin: { createUser: (...args: unknown[]) => createAuth(...args), deleteUser: (...args: unknown[]) => deleteAuth(...args) } } } }));
import { POST } from '@/app/api/auth/register/route';
it('F01 registration DB failure compensates only the Auth identity just created', async () => {
  createAuth.mockResolvedValue({ data: { user: { id: 'new-auth' } }, error: null }); deleteAuth.mockResolvedValue({ error: null });
  const result = await POST(new Request('http://localhost/api/auth/register', { method: 'POST', body: JSON.stringify({ firstName: 'Synthetic', lastName: 'Patient', email: 'synthetic@example.test', password: 'Synthetic-password-123!', role: 'PATIENT', dateOfBirth: '1990-01-01', gender: 'other' }) }) as never);
  expect(result.status).toBe(500); expect(deleteAuth).toHaveBeenCalledWith('new-auth');
});
