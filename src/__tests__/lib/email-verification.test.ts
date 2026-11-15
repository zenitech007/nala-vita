const issue = jest.fn(), confirm = jest.fn(), update = jest.fn();
let user:Pick<import("@prisma/client").User,"id"|"supabaseId"|"isActive"|"email"|"emailVerified">|null, proofValid = true;
const challenge = { targetUserId: 'u' };
const verificationTx={$queryRaw:async()=>[],user:{findUnique:async()=>user,updateMany:update}};
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findMany: async () => user ? [user] : [] }, otpChallenge: { findUnique: async () => challenge } } }));
jest.mock('@/lib/email-otp', () => ({ normalizeEmail: (value: string) => value.trim().toLowerCase(), issueEmailOtp: (...a: unknown[]) => issue(...a),
  consumeEmailOtp: async (_proof: unknown, fn: (tx:typeof verificationTx, proof:typeof challenge) => unknown) => proofValid ? fn(verificationTx, challenge) : false }));
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { auth: { admin: {
  getUserById: async () => ({ data: { user: { email: user?.email } }, error: null }),
  updateUserById: (...a: unknown[]) => confirm(...a),
} } } }));
import { requestEmailVerification, completeEmailVerification } from '@/lib/email-verification';
beforeEach(() => { jest.resetAllMocks(); proofValid = true; user = { id: 'u', supabaseId: 'auth', isActive: true, email: 'synthetic@example.test', emailVerified: false };
  issue.mockResolvedValue({ challengeId: 'challenge' }); confirm.mockResolvedValue({ error: null }); update.mockResolvedValue({ count: 1 }); });
const proof = { challengeId: 'challenge', email: 'synthetic@example.test', code: '123456', ip: '203.0.113.1' };
it('F01 only confirms the stored Auth identity after a valid email proof', async () => {
  proofValid = false; expect(await completeEmailVerification(proof)).toBe(false); expect(confirm).not.toHaveBeenCalled();
  proofValid = true; expect(await completeEmailVerification(proof)).toBe(true);
  expect(confirm).toHaveBeenCalledWith('auth', { email_confirm: true }); expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { emailVerified: true } }));
});
it('F01 unknown or already verified accounts use the same request contract without delivery', async () => {
  await requestEmailVerification(proof.email, proof.ip); expect(issue).toHaveBeenLastCalledWith(expect.objectContaining({ targetUserId: 'u' }));
  if(!user)throw new Error("Synthetic user missing");user.emailVerified = true; await requestEmailVerification(proof.email, proof.ip); expect(issue).toHaveBeenLastCalledWith(expect.objectContaining({ targetUserId: null }));
  user = null; expect(await requestEmailVerification(proof.email, proof.ip)).toEqual({ challengeId: 'challenge' });
});
