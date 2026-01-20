import { render } from '@react-email/render';
import { ResetPassword } from './emails/reset-password';
import { VerifyEmail } from './emails/verify-email';

export async function renderResetPasswordEmail(resetUrl: string): Promise<string> {
  return render(ResetPassword({ resetUrl }));
}

export async function renderVerifyEmail(verificationUrl: string): Promise<string> {
  return render(VerifyEmail({ verificationUrl }));
}
