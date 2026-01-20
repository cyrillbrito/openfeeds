import { renderResetPasswordEmail, renderVerifyEmail } from '@repo/emails';
import { Resend } from 'resend';
import { environment } from './environment';

const resend = environment.resendApiKey ? new Resend(environment.resendApiKey) : null;

const FROM_EMAIL = 'OpenFeeds <noreply@openfeeds.app>';

export async function sendVerificationEmail(email: string, url: string) {
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
