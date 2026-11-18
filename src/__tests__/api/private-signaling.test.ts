const actor = jest.fn(), appointment = jest.fn(), publish = jest.fn();
jest.mock('@/lib/auth', () => ({ requireApiUser: () => actor() }));
jest.mock('@/lib/prisma', () => ({ prisma: { appointment: { findFirst: (...args: unknown[]) => appointment(...args) } } }));
jest.mock('@/lib/realtime-publish', () => ({ publishPrivateEvent: (...args: unknown[]) => publish(...args) }));
jest.mock('@/lib/rate-limit', () => ({ checkRateLimitAsync: async () => ({ allowed: true }) }));
import { POST } from '@/app/api/appointments/[id]/signal/route';
import { receivedCallSignal } from '@/lib/realtime-events';
import { videoIceServers } from '@/lib/turn-config';
const context = { params: Promise.resolve({ id: 'a' }) };
const send = (body: unknown) => POST(new Request('https://example.test/signal', { method: 'POST', body: JSON.stringify(body) }), context);
beforeEach(() => {
  jest.resetAllMocks();
  actor.mockResolvedValue({ ok: true, user: { id: 'clinician', role: 'DOCTOR', doctor: { id: 'd' } } });
  appointment.mockResolvedValue({ id: 'a', doctor: { userId: 'clinician' }, patient: { userId: 'patient' } });
  publish.mockResolvedValue(true);
});
it('F19 relays the server-derived sender only to the other appointment participant', async () => {
  expect((await send({ type: 'offer', data: 'v=0\r\n' })).status).toBe(204);
  expect(appointment).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'a', doctorId: 'd', consultationType: 'VIDEO' }) }));
  expect(publish).toHaveBeenCalledWith('nala:call:a:patient', 'signal', expect.objectContaining({ senderId: 'clinician', receiverId: 'patient', appointmentId: 'a' }));
  const event = publish.mock.calls[0][2];
  expect(receivedCallSignal(event, 'a', 'patient', 'clinician')).not.toBeNull();
  expect(receivedCallSignal({ ...event, senderId: 'intruder' }, 'a', 'patient', 'clinician')).toBeNull();
  expect(receivedCallSignal({ ...event, issuedAt: 0 }, 'a', 'patient', 'clinician')).toBeNull();
});
it.each([{ type: 'ready', senderId: 'forged' }, { type: 'offer', data: 'junk' }, { type: 'ice-candidate', data: {} }])('F19 rejects invalid or forged signal %j', async body => {
  expect((await send(body)).status).toBe(422);
  expect(publish).not.toHaveBeenCalled();
});
it('F19 denies a nonmember and surfaces transport failure', async () => {
  appointment.mockResolvedValueOnce(null);
  expect((await send({ type: 'ready' })).status).toBe(404);
  expect(publish).not.toHaveBeenCalled();
  publish.mockResolvedValue(false);
  expect((await send({ type: 'ready' })).status).toBe(503);
});
it('F19 TURN requires explicitly configured credentials', () => {
  expect(videoIceServers({})).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
  expect(() => videoIceServers({ TURN_URLS: 'turns:relay.example.test' })).toThrow('Invalid TURN configuration');
  expect(videoIceServers({ TURN_URLS: 'turns:relay.example.test', TURN_USERNAME: 'fixture', TURN_CREDENTIAL: 'fixture' })[1]).toMatchObject({ urls: ['turns:relay.example.test'] });
});
