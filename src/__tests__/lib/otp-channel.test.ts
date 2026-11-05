const sendMail = jest.fn(), close = jest.fn(), createTransport = jest.fn();
jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: (...args: unknown[]) => createTransport(...args) } }));
import { EmailOtpChannel, SmsOtpChannel, selectOtpChannel } from '@/lib/otp-channel';
const keys = ['OTP_CHANNEL', 'OTP_SMS_ENABLED', 'OTP_SMTP_HOST', 'OTP_SMTP_PORT', 'OTP_SMTP_USER', 'OTP_SMTP_PASSWORD', 'OTP_EMAIL_FROM'] as const;
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterAll(() => { for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; } });
beforeEach(() => { jest.resetAllMocks(); createTransport.mockReturnValue({ sendMail, close });
  Object.assign(process.env, { OTP_CHANNEL: 'email', OTP_SMS_ENABLED: 'false', OTP_SMTP_HOST: 'smtp.example.test', OTP_SMTP_PORT: '587', OTP_SMTP_USER: 'synthetic', OTP_SMTP_PASSWORD: 'synthetic', OTP_EMAIL_FROM: 'Nala Vita <synthetic@example.test>' }); });
it('F01 uses configured SMTP with TLS and closes the mocked transport', async () => {
  await new EmailOtpChannel().send('patient@example.test', '123456', 'CLAIM');
  expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.example.test', port: 587, requireTLS: true }));
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'patient@example.test', text: expect.stringContaining('123456') })); expect(close).toHaveBeenCalled();
});
it('F01 selects verified email; SMS stays explicitly disabled', async () => {
  expect(selectOtpChannel({ email: 'patient@example.test', verifiedEmail: true })).toBeInstanceOf(EmailOtpChannel);
  expect(() => selectOtpChannel({ email: 'patient@example.test', verifiedEmail: false })).toThrow();
  process.env.OTP_CHANNEL = 'sms'; expect(() => selectOtpChannel({ verifiedEmail: false, verifiedPhone: '+15550000000' })).toThrow('SMS not enabled');
  await expect(new SmsOtpChannel().send('+15550000000', '123456', 'CLAIM')).rejects.toThrow('SMS not enabled'); expect(sendMail).not.toHaveBeenCalled();
});
