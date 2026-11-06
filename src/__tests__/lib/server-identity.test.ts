const getUser = jest.fn(), getSession = jest.fn(), findUser = jest.fn();
jest.mock('react', () => ({ cache: (fn: unknown) => fn }));
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser, getSession } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUser(...a) } } }));
import { getAuthenticatedUserWithProfile } from '@/lib/auth-cache';
beforeEach(() => { jest.resetAllMocks(); getUser.mockResolvedValue({ data: { user: { id: 'auth' } }, error: null }); getSession.mockResolvedValue({ data: { session: { user: { id: 'auth' } } } }); });
it('F09 rejects a session cookie when server identity verification fails', async () => { getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') }); expect(await getAuthenticatedUserWithProfile()).toBeNull(); expect(findUser).not.toHaveBeenCalled(); });
it.each([{ isActive: false, role: 'PATIENT' }, { isActive: true, role: 'DOCTOR', doctor: { isVerified: false } }])('F09 rejects inactive or unverified database identity', async actor => { findUser.mockResolvedValue(actor); expect(await getAuthenticatedUserWithProfile()).toBeNull(); });
it('F10 only uses the verified Auth ID and never reads cookie session data', async () => { getSession.mockRejectedValue(new Error('untrusted')); findUser.mockResolvedValue({ isActive: true, role: 'PATIENT', patient: { id: 'p' } }); const result = await getAuthenticatedUserWithProfile(); expect(result?.session.user.id).toBe('auth'); expect(getSession).not.toHaveBeenCalled(); expect(findUser).toHaveBeenCalledWith(expect.objectContaining({ where: { supabaseId: 'auth' } })); });
