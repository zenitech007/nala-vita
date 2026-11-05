let rows: any[] = [], queue = Promise.resolve();
let budgets = new Map<string, any>();
const matches = (row: any, where: any) => (!where.id || row.id === where.id)
  && (!where.recipientHash || row.recipientHash === where.recipientHash)
  && (!where.ipHash || row.ipHash === where.ipHash)
  && (!where.createdAt?.gte || row.createdAt >= where.createdAt.gte);
const tx = { $queryRaw: async () => [], otpVerificationBudget: {
  findUnique: async ({ where }: any) => budgets.get(where.id) ?? null,
  upsert: async ({ where, create, update }: any) => { const row = budgets.has(where.id) ? { ...budgets.get(where.id), ...update } : create; budgets.set(where.id, row); return row; },
}, otpChallenge: {
  findUnique: async ({ where }: any) => rows.find(row => row.id === where.id) ?? null,
  findFirst: async ({ where }: any) => [...rows].reverse().find(row => matches(row, where)) ?? null,
  count: async ({ where }: any) => rows.filter(row => matches(row, where)).length,
  create: async ({ data }: any) => { const row = { attempts: 0, consumedAt: null, createdAt: new Date(), ...data }; rows.push(row); return row; },
  update: async ({ where, data }: any) => { const row = rows.find(row => row.id === where.id); row.attempts += data.attempts?.increment ?? 0; return row; },
  updateMany: async ({ where, data }: any) => { const row = rows.find(row => row.id === where.id);
    if (!row || row.consumedAt || row.attempts >= 5 || row.expiresAt <= new Date()) return { count: 0 };
    Object.assign(row, data); return { count: 1 };
  },
} };
async function transaction(fn: (tx: any) => unknown) {
  const previous = queue; let release!: () => void; queue = new Promise<void>(resolve => { release = resolve; }); await previous;
  try { return await fn(tx); } finally { release(); }
}
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: (fn: (tx: any) => unknown) => transaction(fn) } }));
let otp: typeof import('@/lib/email-otp');
const send = jest.fn();
const input = { email: 'synthetic@example.test', ip: '203.0.113.1', purpose: 'CLAIM', targetUserId: 'u', binding: 'claim-u', verifiedEmail: true };
const oldSecret = process.env.OTP_HASH_SECRET;
beforeAll(async () => { process.env.OTP_HASH_SECRET = 'synthetic-otp-secret-at-least-32-characters'; otp = await import('@/lib/email-otp'); });
afterAll(() => { if (oldSecret === undefined) delete process.env.OTP_HASH_SECRET; else process.env.OTP_HASH_SECRET = oldSecret; });
beforeEach(() => { rows = []; budgets = new Map(); queue = Promise.resolve(); send.mockReset().mockResolvedValue(undefined); jest.useFakeTimers().setSystemTime(new Date('2030-01-01')); });
afterEach(() => jest.useRealTimers());
async function issue(patch = {}) { return otp.issueEmailOtp({ ...input, ...patch }, { send }); }
const proof = (challengeId: string, code = send.mock.calls[0][1], binding = input.binding) => ({ challengeId, code, purpose: input.purpose, binding });
it('F01 stores a hash, sends six digits, expires after ten minutes and consumes once', async () => {
  const { challengeId } = await issue(); const code = send.mock.calls[0][1]; expect(code).toMatch(/^\d{6}$/);
  expect(rows[0].codeHash).not.toBe(code); expect(JSON.stringify(rows)).not.toContain(`"${code}"`);
  expect(rows[0].expiresAt.getTime() - Date.now()).toBe(600000);
  expect(await otp.consumeEmailOtp(proof(challengeId))).toBe(true); expect(await otp.consumeEmailOtp(proof(challengeId))).toBe(false);
});
it('F01 locks out after five wrong codes', async () => {
  const { challengeId } = await issue(); const wrong = send.mock.calls[0][1] === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) expect(await otp.consumeEmailOtp(proof(challengeId, wrong))).toBe(false);
  expect(await otp.consumeEmailOtp(proof(challengeId))).toBe(false); expect(rows[0].attempts).toBe(5);
});
it('F01 expiry and a different purpose/scope binding invalidate the proof', async () => {
  const { challengeId } = await issue(); expect(await otp.consumeEmailOtp(proof(challengeId, undefined, 'different-binding'))).toBe(false);
  jest.advanceTimersByTime(600000); expect(await otp.consumeEmailOtp(proof(challengeId))).toBe(false);
});
it('F01 two parallel verifications consume at most once', async () => {
  const { challengeId } = await issue(); expect(await Promise.all([otp.consumeEmailOtp(proof(challengeId)), otp.consumeEmailOtp(proof(challengeId))])).toEqual([true, false]);
});
it('F01 cooldown is per normalized email and responses remain existence-neutral', async () => {
  const first = await issue(); const second = await issue({ email: ' SYNTHETIC@EXAMPLE.TEST ' });
  expect(Object.keys(first)).toEqual(['challengeId']); expect(Object.keys(second)).toEqual(['challengeId']); expect(send).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(61000); const absent = await issue({ email: 'unknown@example.test', targetUserId: null });
  expect(absent.challengeId).toEqual(expect.any(String)); expect(send).toHaveBeenCalledTimes(1);
});
it('F01 enforces per-email and per-IP hourly issuance limits', async () => {
  for (let i = 0; i < 6; i++) { await issue(); jest.advanceTimersByTime(61000); }
  expect(send).toHaveBeenCalledTimes(5);
  rows = []; send.mockClear();
  for (let i = 0; i < 21; i++) await issue({ email: `synthetic${i}@example.test` });
  expect(send).toHaveBeenCalledTimes(20);
});
it('F01 verification requests also have a durable per-IP budget', async () => {
  for (let i = 0; i < 31; i++) await otp.consumeEmailOtp({ challengeId: 'unknown', code: '123456', purpose: 'CLAIM', binding: 'unknown', ip: '203.0.113.1' });
  expect([...budgets.values()]).toEqual([expect.objectContaining({ count: 30 })]);
});
