import type {User,Patient,ClaimInvitation} from "@prisma/client";
const createAuth = jest.fn(), deleteAuth = jest.fn(), updateUser = jest.fn(), issueOtp = jest.fn();
type Provisional=Pick<User,"id"|"role"|"isActive"|"supabaseId"|"email"|"firstName"|"lastName">&{patient:Pick<Patient,"id"|"createdByDoctorId">};
let provisional:Provisional,invitation:Pick<ClaimInvitation,"id"|"patientId"|"issuerDoctorId"|"expiresAt"|"usedAt">|null,validProof=true,failDatabase=false;
const challenge: {id:string;targetUserId:string;recipientHash:string;context:{invitationId:string|null}} = { id: 'challenge', targetUserId: 'u', recipientHash: 'digest:email:synthetic@example.test', context: { invitationId: null } };
const tx = { $queryRaw: async () => [], user: { findUnique: async () => provisional,
  updateMany: (...a: unknown[]) => updateUser(...a) }, claimInvitation: { findUnique: async () => invitation,
    updateMany: async () => { if (!invitation || invitation.usedAt) return { count: 0 }; invitation.usedAt = new Date(); return { count: 1 }; } },
  doctor: { findUnique: async () => ({ isVerified: true, user: { isActive: true } }) } };
jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findMany: async ({ where }: {where:{email:{equals:string}}}) => provisional?.email?.toLowerCase() === where.email.equals ? [provisional] : [] }, otpChallenge: { findUnique: async () => challenge },
  claimInvitation: { findUnique: async ({ where }: {where:{tokenHash:string}}) => where.tokenHash === 'digest:invite:clinic-code' ? invitation : null },
  patient: { findUnique: async () => ({ id: 'p', userId: 'u', createdByDoctorId: 'd', user: provisional }) },
  doctor: { findUnique: async () => ({ isVerified: true, user: { isActive: true } }) },
} }));
jest.mock('@/lib/email-otp', () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(), otpDigest: (value: string) => `digest:${value}`,
  issueEmailOtp: (...a: unknown[]) => issueOtp(...a),
  consumeEmailOtp: async (_proof: unknown, fn: (client:typeof tx,row:typeof challenge) => unknown) => validProof ? fn(tx, challenge) : false,
}));
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { auth: { admin: { createUser: (...a: unknown[]) => createAuth(...a), deleteUser: (...a: unknown[]) => deleteAuth(...a) } } } }));
let claims: typeof import('@/lib/patient-claim');
beforeAll(async () => { claims = await import('@/lib/patient-claim'); });
beforeEach(() => {
  jest.resetAllMocks(); validProof = true; failDatabase = false;
  invitation = null; challenge.context.invitationId = null; challenge.recipientHash = 'digest:email:synthetic@example.test';
  provisional = { id: 'u', role: 'PATIENT', isActive: true, supabaseId: null, email: 'synthetic@example.test',
    firstName: 'Synthetic', lastName: 'Patient', patient: { id: 'p', createdByDoctorId: 'd' } };
  createAuth.mockResolvedValue({ data: { user: { id: 'new-auth' } }, error: null });
  deleteAuth.mockResolvedValue({ error: null }); issueOtp.mockResolvedValue({ challengeId: 'challenge' });
  updateUser.mockImplementation(async ({ where, data }) => { if (failDatabase) throw new Error('synthetic DB failure');
    if (provisional.supabaseId !== where.supabaseId) return { count: 0 }; Object.assign(provisional, data); return { count: 1 };
  });
});
const proof = { challengeId: 'challenge', code: '123456', email: 'synthetic@example.test', password: 'Synthetic-password-123!' };
it('F01 only emails the address already on an unbound record', async () => {
  await claims.requestPatientClaim(proof.email, '203.0.113.1');
  expect(issueOtp).toHaveBeenCalledWith(expect.objectContaining({ email: provisional.email, targetUserId: 'u', purpose: 'CLAIM' }));
  provisional.supabaseId = 'already-bound'; await claims.requestPatientClaim(proof.email, '203.0.113.1');
  expect(issueOtp).toHaveBeenLastCalledWith(expect.objectContaining({ targetUserId: null }));
});
it('F01 invalid proof cannot create Auth or bind a record', async () => {
  validProof = false; expect(await claims.completePatientClaim(proof)).toBe(false);
  expect(createAuth).not.toHaveBeenCalled(); expect(updateUser).not.toHaveBeenCalled();
});
it('F01 verified proof binds once with a conditional unbound update', async () => {
  expect(await claims.completePatientClaim(proof)).toBe(true);
  expect(createAuth).toHaveBeenCalledWith(expect.objectContaining({ email: proof.email, email_confirm: true }));
  expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'u', supabaseId: null }),
    data: expect.objectContaining({ supabaseId: 'new-auth', emailVerified: true }) }));
  expect(await claims.completePatientClaim(proof)).toBe(false); expect(createAuth).toHaveBeenCalledTimes(1);
});
it('F01 DB failure compensates the Auth user created by this claim', async () => {
  failDatabase = true; await expect(claims.completePatientClaim(proof)).rejects.toThrow();
  expect(deleteAuth).toHaveBeenCalledWith('new-auth');
});
it('F01 bound records cannot be reclaimed even with a proof for an earlier challenge', async () => {
  provisional.supabaseId = 'existing-auth'; expect(await claims.completePatientClaim(proof)).toBe(false);
  expect(createAuth).not.toHaveBeenCalled();
});
it('F01 phone-only records require a valid clinic invitation and proof of the chosen email', async () => {
  provisional.email = null;
  await claims.requestPatientClaim(proof.email, '203.0.113.1');
  expect(issueOtp).toHaveBeenLastCalledWith(expect.objectContaining({ targetUserId: null }));
  invitation = { id: 'invite', patientId: 'p', issuerDoctorId: 'd', expiresAt: new Date(Date.now() + 3600000), usedAt: null };
  await claims.requestPatientClaim(proof.email, '203.0.113.1', 'clinic-code');
  expect(issueOtp).toHaveBeenLastCalledWith(expect.objectContaining({ targetUserId: 'u', context: { invitationId: 'invite' } }));
  challenge.context.invitationId = 'invite';
  expect(await claims.completePatientClaim(proof)).toBe(true); expect(invitation.usedAt).toEqual(expect.any(Date));
});
it('F01 cannot change the recipient email after challenge issuance', async () => {
  expect(await claims.completePatientClaim({ ...proof, email: 'another@example.test' })).toBe(false); expect(createAuth).not.toHaveBeenCalled();
});
