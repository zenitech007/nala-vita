const guard = jest.fn(), update = jest.fn();
jest.mock('@/lib/auth', () => ({ requireApiUser: (...args: unknown[]) => guard(...args) }));
jest.mock('@/lib/prisma', () => ({ prisma: { doctor: { update: (...args: unknown[]) => update(...args) } } }));
import { PATCH } from '@/app/api/doctors/availability/route';
beforeEach(() => { jest.resetAllMocks(); guard.mockResolvedValue({ ok: true, user: { doctor: { id: 'own' } } }); });
const data = { timeZone: 'America/Phoenix', availableDays: ['Monday'], availableFrom: '09:00', availableTo: '17:00' };
const req = (body: unknown) => new Request('http://localhost/api/doctors/availability', { method: 'PATCH', body: JSON.stringify(body) }) as never;
it('F13 saves explicit timezone only on the authenticated verified doctor', async () => {
  expect((await PATCH(req({ ...data, doctorId: 'other' }))).status).toBe(200);
  expect(guard).toHaveBeenCalledWith({ roles: ['DOCTOR'], profile: 'doctor' });
  expect(update).toHaveBeenCalledWith({ where: { id: 'own' }, data });
});
it.each([{ timeZone: 'invalid' }, { availableDays: [] }, { availableTo: '08:00' }])('F13 rejects invalid availability %j', async patch => {
  expect((await PATCH(req({ ...data, ...patch }))).status).toBe(422); expect(update).not.toHaveBeenCalled();
});
it('F13 denies rejected identities before writing', async () => {
  guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
  expect((await PATCH(req(data))).status).toBe(403); expect(update).not.toHaveBeenCalled();
});
