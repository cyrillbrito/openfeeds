import type { ResetPasswordProps, VerifyEmailProps } from '@repo/emails';
import { Resend } from 'resend';
import { environment } from './environment';

const resend = environment.resendApiKey ? new Resend(environment.resendApiKey) : null;

const FROM_EMAIL = 'OpenFeeds <noreply@openfeeds.app>';

// Resend template IDs - update these with your actual template IDs
const TEMPLATE_IDS = {
  verifyEmail: '', // e.g. 're_xxx'
  resetPassword: '', // e.g. 're_xxx'
} as const;

export async function sendVerificationEmail(email: string, url: string) {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping verification email');
    console.log('[Email] Verification URL:', url);
    return;
  }

  const data: VerifyEmailProps = { verificationUrl: url };

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your email address',
    // TODO: uncomment when template ID is set
    // templateId: TEMPLATE_IDS.verifyEmail,
    // data,
    html: `<p>Verify your email: <a href="${url}">${url}</a></p>`,
  });
}

export async function sendPasswordResetEmail(email: string, url: string) {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping password reset email');
    console.log('[Email] Reset URL:', url);
    return;
  }

  const data: ResetPasswordProps = { resetUrl: url };

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your password',
    // TODO: uncomment when template ID is set
    // templateId: TEMPLATE_IDS.resetPassword,
    // data,
    html: `<p>Reset your password: <a href="${url}">${url}</a></p>`,
  });
}
