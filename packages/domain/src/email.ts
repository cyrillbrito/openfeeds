import { renderResetPasswordEmail, renderVerifyEmail } from '@repo/emails';
import { Resend } from 'resend';
import { getConfig } from './config';

// Lazy-initialized Resend client
let _resend: Resend | null = null;
let _resendChecked = false;

function getResend(): Resend | null {
  if (!_resendChecked) {
    const config = getConfig();
    _resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;
    _resendChecked = true;
  }
  return _resend;
}

const FROM_EMAIL = 'OpenFeeds <noreply@openfeeds.app>';

export async function sendVerificationEmail(email: string, url: string) {
  const resend = getResend();
  if (!resend) {
    console.log('[Email] Resend not configured, skipping verification email');
    console.log('[Email] Verification URL:', url);
    return;
  }

  const html = await renderVerifyEmail(url);
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your email address',
    html,
  });
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const resend = getResend();
  if (!resend) {
    console.log('[Email] Resend not configured, skipping password reset email');
    console.log('[Email] Reset URL:', url);
    return;
  }

  const html = await renderResetPasswordEmail(url);
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your password',
    html,
  });
}
