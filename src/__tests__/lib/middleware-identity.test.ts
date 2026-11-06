const getUser = jest.fn(), getSession = jest.fn();
jest.mock('@supabase/auth-helpers-nextjs', () => ({ createServerClient: (_url: unknown, _key: unknown, config: any) => {
  config.cookies.setAll([{ name: 'refreshed', value: 'new', options: { httpOnly: true } }]);
  return { auth: { getUser, getSession } };
} }));
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
beforeEach(() => { jest.resetAllMocks(); getUser.mockResolvedValue({ data: { user: null }, error: null }); getSession.mockResolvedValue({ data: { session: { user: { id: 'forged', user_metadata: { role: 'ADMIN' } } } } }); });
it('F10 rejects cookie-derived identity and retains refreshed cookies on redirect', async () => {
  const result = await middleware(new NextRequest('https://example.test/admin/dashboard'));
  expect(result.headers.get('location')).toContain('/login');
  expect(result.cookies.get('refreshed')?.value).toBe('new'); expect(getSession).not.toHaveBeenCalled();
});
it('F10 identity provider failure redirects safely and retains refreshed cookies', async () => {
  getUser.mockRejectedValue(new Error('unavailable')); getSession.mockRejectedValue(new Error('unavailable'));
  const result = await middleware(new NextRequest('https://example.test/patient/dashboard'));
  expect(result.headers.get('location')).toContain('/login'); expect(result.cookies.get('refreshed')?.value).toBe('new');
});
