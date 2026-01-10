import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface VerifyEmailProps {
  verificationUrl?: string;
}

export const VerifyEmail = ({ verificationUrl }: VerifyEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>Verify your email address for OpenFeeds</Preview>
      <Container style={container}>
        <Heading style={logo}>OpenFeeds</Heading>
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          Thanks for signing up! Please verify your email address by clicking
          the button below.
        </Text>
        <Section style={buttonContainer}>
          <Button style={button} href={verificationUrl}>
            Verify Email
          </Button>
        </Section>
        <Text style={text}>
          Or copy and paste this link into your browser:
        </Text>
        <Link href={verificationUrl} style={link}>
          {verificationUrl}
        </Link>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't create an account on OpenFeeds, you can safely ignore
          this email.
        </Text>
      </Container>
    </Body>
  </Html>
);

VerifyEmail.PreviewProps = {
  verificationUrl: 'https://openfeeds.app/verify?token=abc123xyz',
} as VerifyEmailProps;

export default VerifyEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  marginTop: '40px',
  marginBottom: '40px',
  borderRadius: '8px',
  maxWidth: '480px',
};

const logo = {
  color: '#f97316',
  fontSize: '24px',
  fontWeight: '700' as const,
  textAlign: 'center' as const,
  margin: '0 0 24px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600' as const,
  lineHeight: '32px',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const text = {
  color: '#525252',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  backgroundColor: '#f97316',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
};

const link = {
  color: '#f97316',
  fontSize: '12px',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
  display: 'block',
  textAlign: 'center' as const,
};

const hr = {
  borderColor: '#e5e5e5',
  margin: '32px 0',
};

const footer = {
  color: '#a3a3a3',
  fontSize: '12px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '0',
};
