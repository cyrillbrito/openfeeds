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

interface AnnouncementProps {
  name?: string;
}

export const Announcement = ({ name }: AnnouncementProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>OpenFeeds is now live - Your early access is ready</Preview>
      <Container style={container}>
        <Section style={badge}>
          <Text style={badgeText}>Early Access</Text>
        </Section>
        <Heading style={logo}>OpenFeeds</Heading>
        <Heading style={h1}>We're live!</Heading>
        <Text style={text}>
          {name ? `Hey ${name},` : 'Hey there,'}
        </Text>
        <Text style={text}>
          Thanks for your interest in OpenFeeds. We're excited to announce that
          our early access is now open!
        </Text>
        <Text style={text}>
          OpenFeeds is a modern RSS reader that helps you stay on top of your
          favorite content without the noise. No algorithms, no ads — just the
          content you care about.
        </Text>
        <Section style={features}>
          <Text style={featureItem}>Follow unlimited feeds</Text>
          <Text style={featureItem}>Smart tagging & organization</Text>
          <Text style={featureItem}>Fast & clean reading experience</Text>
        </Section>
        <Section style={buttonContainer}>
          <Button style={button} href="https://openfeeds.app">
            Get Started
          </Button>
        </Section>
        <Text style={textSmall}>
          As an early user, your feedback is invaluable. Reply to this email
          anytime — we read everything.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          OpenFeeds · Built for readers who value their time
        </Text>
        <Link href="https://openfeeds.app/unsubscribe" style={unsubscribe}>
          Unsubscribe
        </Link>
      </Container>
    </Body>
  </Html>
);

Announcement.PreviewProps = {
  name: 'John',
} as AnnouncementProps;

export default Announcement;

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

const badge = {
  textAlign: 'center' as const,
  marginBottom: '16px',
};

const badgeText = {
  backgroundColor: '#fef3c7',
  color: '#b45309',
  fontSize: '12px',
  fontWeight: '600' as const,
  padding: '4px 12px',
  borderRadius: '16px',
  display: 'inline-block',
  margin: '0',
};

const logo = {
  color: '#f97316',
  fontSize: '28px',
  fontWeight: '700' as const,
  textAlign: 'center' as const,
  margin: '0 0 32px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '600' as const,
  lineHeight: '36px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
};

const text = {
  color: '#525252',
  fontSize: '15px',
  lineHeight: '26px',
  margin: '0 0 16px',
};

const textSmall = {
  color: '#737373',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '24px 0 0',
  textAlign: 'center' as const,
};

const features = {
  backgroundColor: '#fafafa',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '24px 0',
};

const featureItem = {
  color: '#525252',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px',
  paddingLeft: '20px',
  position: 'relative' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#f97316',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '14px 32px',
};

const hr = {
  borderColor: '#e5e5e5',
  margin: '32px 0 24px',
};

const footer = {
  color: '#a3a3a3',
  fontSize: '12px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '0 0 8px',
};

const unsubscribe = {
  color: '#a3a3a3',
  fontSize: '12px',
  textDecoration: 'underline',
  display: 'block',
  textAlign: 'center' as const,
};
