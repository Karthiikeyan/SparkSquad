import type { Bindings } from '../env';

/** Sends the sign-in code with Resend. Without a key, codes are only logged in local environments. */
export async function sendOtpEmail(env: Bindings, email: string, otp: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (env.APP_ENV === 'development') console.warn(`[dev] OTP for ${email}: ${otp}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: `${otp} is your SparkSquad code`,
      text: `Your SparkSquad sign-in code is ${otp}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<p>Your SparkSquad sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p><p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
    }),
  });
  if (!res.ok) console.error('Resend failed', res.status);
}
