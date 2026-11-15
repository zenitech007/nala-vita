const user = jest.fn(), records = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth', user_metadata: { role: 'ADMIN', is_active: true, is_verified: true } } } }) } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: () => user() }, doctor: { findMany: () => records() }, notification: { findMany: () => records(), count: () => records() }, payment: { findMany: () => records() } } }));
jest.mock('@/lib/amelia/reminders', () => ({ fireDueReminders: async () => 0 }));
import { GET as staff } from '@/app/api/admin/staff/route';
import { GET as notifications } from '@/app/api/notifications/route';
import { GET as payments } from '@/app/api/payments/route';
beforeEach(() => { jest.resetAllMocks(); });
it('F10 editable admin metadata cannot override the database role', async () => {
  user.mockResolvedValue({ id: 'u', role: 'PATIENT', isActive: true, patient: { id: 'p' } });
  expect((await staff()).status).toBe(403); expect(records).not.toHaveBeenCalled();
});
it.each([staff, notifications, payments])('F10 deactivation prevents data access despite tampered active metadata', async handler => {
  user.mockResolvedValue({ id: 'u', role: 'ADMIN', isActive: false, admin: { id: 'a' } });
  expect((await handler(new Request('https://example.test/api/test') as never)).status).toBe(403); expect(records).not.toHaveBeenCalled();
});
