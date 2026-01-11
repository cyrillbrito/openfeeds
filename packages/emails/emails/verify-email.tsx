import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { EmailFrame } from './components/email-frame';
import { button, buttonContainer, h1, link, text } from './styles';

export interface VerifyEmailProps {
  verificationUrl?: string;
}

export const VerifyEmail = ({ verificationUrl }: VerifyEmailProps) => (
  <EmailFrame
    preview="Verify your email address for OpenFeeds"
    footerText="If you didn't create an account on OpenFeeds, you can safely ignore this email."
  >
    <Heading style={h1}>Verify your email</Heading>
    <Text style={text}>
      Thanks for signing up! Please verify your email address by clicking the button below.
    </Text>
    <Section style={buttonContainer}>
      <Button style={button} href={verificationUrl}>
        Verify Email
      </Button>
    </Section>
    <Text style={text}>Or copy and paste this link into your browser:</Text>
    <Link href={verificationUrl} style={link}>
      {verificationUrl}
    </Link>
  </EmailFrame>
);

VerifyEmail.PreviewProps = {
  verificationUrl: 'https://openfeeds.app/verify?token=abc123xyz',
} as VerifyEmailProps;

export default VerifyEmail;
