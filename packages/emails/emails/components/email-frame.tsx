import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import {
  container,
  footer,
  hr,
  logoContainer,
  logoImg,
  logoText,
  main,
  unsubscribe,
} from '../styles';

const UNSUBSCRIBE_URL = '{{{RESEND_UNSUBSCRIBE_URL}}}';

interface EmailFrameProps {
  preview: string;
  children: React.ReactNode;
  footerText?: string;
  showUnsubscribe?: boolean;
}

export function EmailFrame({ preview, children, footerText, showUnsubscribe }: EmailFrameProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{preview}</Preview>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src="https://openfeeds.app/_emails/logo.png"
              width="40"
              height="30"
              alt="OpenFeeds"
              style={logoImg}
            />
            <Text style={logoText}>OpenFeeds</Text>
          </Section>
          {children}
          {(footerText || showUnsubscribe) && (
            <>
              <Hr style={hr} />
              {footerText && <Text style={footer}>{footerText}</Text>}
              {showUnsubscribe && (
                <Link href={UNSUBSCRIBE_URL} style={unsubscribe}>
                  Unsubscribe
                </Link>
              )}
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}
