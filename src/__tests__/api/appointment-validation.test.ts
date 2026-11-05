const getUser = jest.fn(), findUser = jest.fn(), findDoctor = jest.fn();
const conflicts = jest.fn(), createAppointment = jest.fn(), createPayment = jest.fn();
jest.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser } }) }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: (...args: unknown[]) => findUser(...args) },
  doctor: { findUnique: (...args: unknown[]) => findDoctor(...args) },
  appointment: { findMany: (...args: unknown[]) => conflicts(...args) },
  $transaction: async (fn: (tx: unknown) => unknown) => fn({
    $queryRaw: async () => [],
    appointment: { create: createAppointment }, payment: { create: createPayment },
  }),
} }));
import { POST } from '@/app/api/appointments/route';
const valid = { doctorId: 'doctor', scheduledAt: '2030-01-07T17:00:00.000Z', duration: 30, consultationType: 'VIDEO' };
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00Z'));
  getUser.mockResolvedValue({ data: { user: { id: 'auth' } } });
  findUser.mockResolvedValue({ id: 'user', role: 'PATIENT', isActive: true, patient: { id: 'patient' } });
  findDoctor.mockResolvedValue({ id: 'doctor', isVerified: true, user: { isActive: true },
    timeZone: 'America/Phoenix', availableDays: ['Monday'], availableFrom: '09:00', availableTo: '17:00', consultationFee: 10 });
  conflicts.mockResolvedValue([]);
  createAppointment.mockResolvedValue({ id: 'appointment' }); createPayment.mockResolvedValue({ id: 'payment' });
});
afterEach(() => jest.useRealTimers());
async function book(patch = {}) {
  return POST(new Request('http://localhost/api/appointments', { method: 'POST', body: JSON.stringify({ ...valid, ...patch }) }) as never);
}
it.each([
  ['unverified', { isVerified: false }], ['inactive', { user: { isActive: false } }],
  ['missing timezone', { timeZone: null }], ['invalid timezone', { timeZone: 'Invalid/Zone' }],
  ['missing availability', { availableFrom: null }],
])('F13 rejects %s doctor before writes', async (_, patch) => {
  findDoctor.mockResolvedValue({ ...await findDoctor(), ...patch });
  const result = await book(); expect(result.status).toBe(422); expect(createAppointment).not.toHaveBeenCalled();
});
it.each([
  { scheduledAt: '2029-12-31T17:00:00.000Z' }, { duration: 30.5 },
  { scheduledAt: '2030-01-07T15:00:00.000Z' }, // 08:00 Phoenix
  { scheduledAt: '2030-01-08T17:00:00.000Z' }, // Tuesday
  { scheduledAt: '2030-01-07T23:45:00.000Z' }, // end crosses 17:00
])('F13 rejects invalid/outside slot %j', async (patch) => {
  expect((await book(patch)).status).toBe(422); expect(createAppointment).not.toHaveBeenCalled();
});
it('F13 accepts future integer slot within the doctor IANA timezone', async () => {
  expect((await book()).status).toBe(201); expect(createAppointment).toHaveBeenCalledTimes(1);
});
it('F13 rejects deactivated patient', async () => {
  findUser.mockResolvedValue({ id: 'user', role: 'PATIENT', isActive: false, patient: { id: 'patient' } });
  expect((await book()).status).toBe(403); expect(createAppointment).not.toHaveBeenCalled();
});
