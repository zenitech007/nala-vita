import type {OtpChallenge,OtpVerificationBudget} from "@prisma/client";
import {mockOf} from "../helpers/mock";
const edgeBudget = jest.fn();
jest.mock('@/lib/rate-limit', () => ({ checkRateLimitAsync: (...args: unknown[]) => edgeBudget(...args) }));
type ChallengeWhere={id?:string;recipientHash?:string;ipHash?:string;createdAt?:{gte:Date}};
let rows:OtpChallenge[]=[],queue=Promise.resolve();
let budgets=new Map<string,OtpVerificationBudget>();
const matches=(row:OtpChallenge,where:ChallengeWhere)=>(!where.id||row.id===where.id)
 &&(!where.recipientHash||row.recipientHash===where.recipientHash)&&(!where.ipHash||row.ipHash===where.ipHash)
 &&(!where.createdAt?.gte||row.createdAt>=where.createdAt.gte);
const tx={ $queryRaw:async()=>[],otpVerificationBudget:{
 findUnique:async({where}:{where:{id:string}})=>budgets.get(where.id)??null,
 upsert:async({where,create,update}:{where:{id:string};create:OtpVerificationBudget;update:Partial<OtpVerificationBudget>})=>{const previous=budgets.get(where.id);const row=previous?{...previous,...update}:create;budgets.set(where.id,row);return row;},
},otpChallenge:{
 findUnique:async({where}:{where:{id:string}})=>rows.find(row=>row.id===where.id)??null,
 findFirst:async({where}:{where:ChallengeWhere})=>[...rows].reverse().find(row=>matches(row,where))??null,
 count:async({where}:{where:ChallengeWhere})=>rows.filter(row=>matches(row,where)).length,
 create:async({data}:{data:Omit<OtpChallenge,"attempts"|"consumedAt"|"createdAt">})=>{const row={attempts:0,consumedAt:null,createdAt:new Date(),...data};rows.push(row);return row;},
 update:async({where,data}:{where:{id:string};data:{attempts?:{increment:number}}})=>{const row=rows.find(row=>row.id===where.id);if(!row)throw new Error("Synthetic OTP row missing");row.attempts+=data.attempts?.increment??0;return row;},
 updateMany:async({where,data}:{where:{id:string};data:Partial<OtpChallenge>})=>{const row=rows.find(row=>row.id===where.id);if(!row||row.consumedAt||row.attempts>=5||row.expiresAt<=new Date())return {count:0};Object.assign(row,data);return {count:1};},
}};
async function transaction(fn:(client:typeof tx)=>unknown){
 const previous=queue;let release!:()=>void;queue=new Promise<void>(resolve=>{release=resolve;});await previous;
 try{return await fn(tx);}finally{release();}
}
jest.mock('@/lib/prisma',()=>({prisma:{$transaction:(fn:(client:typeof tx)=>unknown)=>transaction(fn)}}));
let otp: typeof import('@/lib/email-otp');
const send=mockOf<import("@/lib/otp-channel").OtpChannel["send"]>();
const input = { email: 'synthetic@example.test', ip: '203.0.113.1', purpose: 'CLAIM', targetUserId: 'u', binding: 'claim-u', verifiedEmail: true };
const oldSecret = process.env.OTP_HASH_SECRET;
beforeAll(async () => { process.env.OTP_HASH_SECRET = 'synthetic-otp-secret-at-least-32-characters'; otp = await import('@/lib/email-otp'); });
afterAll(() => { if (oldSecret === undefined) delete process.env.OTP_HASH_SECRET; else process.env.OTP_HASH_SECRET = oldSecret; });
beforeEach(() => { edgeBudget.mockReset().mockResolvedValue({ allowed: true }); rows = []; budgets = new Map(); queue = Promise.resolve(); send.mockReset().mockResolvedValue(undefined); jest.useFakeTimers().setSystemTime(new Date('2030-01-01')); });
afterEach(() => jest.useRealTimers());
async function issue(patch:Partial<Parameters<typeof import("@/lib/email-otp").issueEmailOtp>[0]> = {}) { return otp.issueEmailOtp({ ...input, ...patch }, { send }); }
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

it('F37 keeps the neutral issuance and verification responses when the edge budget is exhausted', async () => {
  edgeBudget.mockResolvedValue({ allowed: false });
  expect(await issue()).toEqual({ challengeId: expect.any(String) });
  expect(send).not.toHaveBeenCalled();
  expect(rows).toHaveLength(0);
  expect(await otp.consumeEmailOtp({ challengeId: 'unknown', code: '123456', purpose: 'CLAIM', binding: 'unknown', ip: input.ip })).toBe(false);
  expect(budgets.size).toBe(0);
});
