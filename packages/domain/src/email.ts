import { ResetPassword, VerifyEmail } from '@repo/emails';
import { Resend } from 'resend';
import { env } from './env';

// Lazy-initialized Resend client
let _resend: Resend | null = null;
let _resendChecked = false;

function getResend(): Resend | null {
  if (!_resendChecked) {
    _resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
    _resendChecked = true;
  }
  return _resend;
}

const FROM_EMAIL = 'OpenFeeds <noreply@mail.openfeeds.app>';

export async function sendVerificationEmail(email: string, url: string) {
  const resend = getResend();
  if (!resend) {
    console.log('[Email] Resend not configured, skipping verification email');
    console.log('[Email] Verification URL:', url);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
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
    to: email,
    subject: 'Reset your password',
    react: ResetPassword({ resetUrl: url }),
  });
}
