import { Button, Heading, Section, Text } from '@react-email/components';
import { EmailFrame } from './components/email-frame';
import { button, buttonContainer, textLeft, textSmall } from './styles';

export const Announcement = () => (
  <EmailFrame
    preview="OpenFeeds is now live - Your early access is ready"
    footerText="OpenFeeds · Built for readers who value their time"
    showUnsubscribe
  >
    <Section style={badge}>
      <Text style={badgeText}>Early Access</Text>
    </Section>
    <Heading style={h1}>We're live!</Heading>
    <Text style={textLeft}>Hey there,</Text>
    <Text style={textLeft}>
      Thanks for your interest in OpenFeeds. We're excited to announce that our early access is now
      open!
    </Text>
    <Text style={textLeft}>
      OpenFeeds is a modern RSS reader that helps you stay on top of your favorite content without
      the noise. No algorithms, no ads — just the content you care about.
    </Text>
    <Section style={features}>
      <Text style={featureItem}>RSS, YouTube, newsletters & more</Text>
      <Text style={featureItem}>Smart tagging & organization</Text>
      <Text style={featureItem}>Fast & clean reading experience</Text>
    </Section>
    <Section style={buttonContainer}>
      <Button style={button} href="https://openfeeds.app">
        Get Started
      </Button>
    </Section>
    <Text style={textSmall}>
      As an early user, your feedback is invaluable. Reply to this email anytime — we read
      everything.
    </Text>
  </EmailFrame>
);

export default Announcement;

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

const h1 = {
  color: '#2e2e2e',
  fontSize: '28px',
  fontWeight: '600' as const,
  lineHeight: '36px',
  margin: '0 0 24px',
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
