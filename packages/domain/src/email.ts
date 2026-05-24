import { ResetPassword, VerifyEmail } from '@repo/emails';
import { Resend } from 'resend';
import { env } from './env';

// Lazy-initialized Resend client
let resendClient: Resend | null = null;
let resendChecked = false;

function getResend(): Resend | null {
  if (!resendChecked) {
    resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
    resendChecked = true;
  }
  return resendClient;
}

const FROM_EMAIL = 'OpenFeeds <hello@mail.openfeeds.app>';
const REPLY_TO = 'hello@openfeeds.app';

export async function sendVerificationEmail(email: string, url: string) {
  const resend = getResend();
  if (!resend) {
    console.log('[Email] Resend not configured, skipping verification email');
    console.log('[Email] Verification URL:', url);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: email,
    subject: 'Verify your email address',
    react: VerifyEmail({ verificationUrl: url }),
  });
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const resend = getResend();
  if (!resend) {
    console.log('[Email] Resend not configured, skipping password reset email');
    console.log('[Email] Reset URL:', url);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: email,
    subject: 'Reset your password',
    react: ResetPassword({ resetUrl: url }),
  });
}
