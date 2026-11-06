import nodemailer from "nodemailer";

export interface OtpChannel {
  send(recipient: string, code: string, purpose: string): Promise<void>;
}
export class EmailOtpChannel implements OtpChannel {
  async send(recipient: string, code: string, purpose: string): Promise<void> {
    const subject = purpose === "RECORD_ACCESS_APPROVAL" ? "Approve access to your records" : "Verify your Nala Vita email";
    await sendAppEmail(recipient, subject, `Your Nala Vita verification code is ${code}. It expires in 10 minutes and can be used once. If you did not request it, ignore this email.`);
  }
}
export async function sendAppEmail(recipient: string, subject: string, text: string): Promise<void> {
    const host = process.env.OTP_SMTP_HOST, user = process.env.OTP_SMTP_USER, pass = process.env.OTP_SMTP_PASSWORD;
    const from = process.env.OTP_EMAIL_FROM, port = Number(process.env.OTP_SMTP_PORT);
    if (!host || !user || !pass || !from || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email OTP delivery is not configured");
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: true,
      auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
    try { await transport.sendMail({ from, to: recipient, subject, text }); }
    finally { transport.close(); }
}
export class SmsOtpChannel implements OtpChannel {
  async send(_recipient: string, _code: string, _purpose: string): Promise<void> { throw new Error("SMS not enabled"); }
}
export function selectOtpChannel(contact: { email?: string | null; verifiedEmail: boolean; verifiedPhone?: string | null }): OtpChannel {
  const channel = process.env.OTP_CHANNEL ?? "email";
  if (channel === "sms") {
    if (process.env.OTP_SMS_ENABLED !== "true") throw new Error("SMS not enabled");
    if (!contact.verifiedPhone) throw new Error("A verified phone contact is required");
    return new SmsOtpChannel();
  }
  if (channel !== "email" || !contact.email || !contact.verifiedEmail) throw new Error("A verified email contact is required");
  return new EmailOtpChannel();
}
