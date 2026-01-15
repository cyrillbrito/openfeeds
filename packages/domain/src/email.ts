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

  // TODO: use Resend templates when ready
  // const data: VerifyEmailProps = { verificationUrl: url };

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your email address',
    html: `<p>Verify your email: <a href="${url}">${url}</a></p>`,
  });
}

export async function sendPasswordResetEmail(email: string, url: string) {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping password reset email');
    console.log('[Email] Reset URL:', url);
    return;
  }

  // TODO: use Resend templates when ready
  // const data: ResetPasswordProps = { resetUrl: url };

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your password',
    html: `<p>Reset your password: <a href="${url}">${url}</a></p>`,
  });
}
