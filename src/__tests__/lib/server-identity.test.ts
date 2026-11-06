const getUser = jest.fn(), getSession = jest.fn(), findUser = jest.fn();
jest.mock('react', () => ({ cache: (fn: unknown) => fn }));
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser, getSession } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUser(...a) } } }));
import { getAuthenticatedUserWithProfile } from '@/lib/auth-cache';
beforeEach(() => { jest.resetAllMocks(); getUser.mockResolvedValue({ data: { user: { id: 'auth' } }, error: null }); getSession.mockResolvedValue({ data: { session: { user: { id: 'auth' } } } }); });
it('F09 rejects a session cookie when server identity verification fails', async () => { getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') }); expect(await getAuthenticatedUserWithProfile()).toBeNull(); expect(findUser).not.toHaveBeenCalled(); });
it.each([{ isActive: false, role: 'PATIENT' }, { isActive: true, role: 'DOCTOR', doctor: { isVerified: false } }])('F09 rejects inactive or unverified database identity', async actor => { findUser.mockResolvedValue(actor); expect(await getAuthenticatedUserWithProfile()).toBeNull(); });
it('F09 refuses a session for a different verified identity', async () => { getSession.mockResolvedValue({ data: { session: { user: { id: 'other' } } } }); expect(await getAuthenticatedUserWithProfile()).toBeNull(); expect(findUser).not.toHaveBeenCalled(); });
