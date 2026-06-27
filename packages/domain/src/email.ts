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

// Adds an email to the configured Resend "Audience" (mailing list). Used by
// the marketing waitlist subscribe form. No email is sent — the audience is
// later targeted by a broadcast campaign. Returns a discriminated result so
// the caller (an HTTP route handler) doesn't have to translate exceptions:
// "not configured" and "Resend rejected the contact" both map to a 500 with
// a user-safe message.
export async function addContactToWaitlist(
  email: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const resend = getResend();
  if (!resend || !env.RESEND_AUDIENCE_ID) {
    return { success: false, error: 'Subscribe service not configured' };
  }

  try {
    await resend.contacts.create({
      email,
      audienceId: env.RESEND_AUDIENCE_ID,
    });
    return { success: true };
  } catch (err) {
    console.error('[Waitlist] Resend contacts.create failed:', err);
    return { success: false, error: 'Failed to subscribe' };
  }
}
