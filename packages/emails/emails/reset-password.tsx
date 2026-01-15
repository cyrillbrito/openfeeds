import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { EmailFrame } from './components/email-frame';
import { button, buttonContainer, h1, link, text } from './styles';

export interface ResetPasswordProps {
  resetUrl?: string;
}

export const ResetPassword = ({ resetUrl }: ResetPasswordProps) => (
  <EmailFrame
    preview="Reset your OpenFeeds password"
    footerText="This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email."
  >
    <Heading style={h1}>Reset your password</Heading>
    <Text style={text}>
      We received a request to reset your password. Click the button below to
      choose a new one.
    </Text>
    <Section style={buttonContainer}>
      <Button style={button} href={resetUrl}>
        Reset Password
      </Button>
    </Section>
    <Text style={text}>Or copy and paste this link into your browser:</Text>
    <Link href={resetUrl} style={link}>
      {resetUrl}
    </Link>
  </EmailFrame>
);

ResetPassword.PreviewProps = {
  resetUrl: 'https://openfeeds.app/reset-password?token=abc123xyz',
} as ResetPasswordProps;

export default ResetPassword;
