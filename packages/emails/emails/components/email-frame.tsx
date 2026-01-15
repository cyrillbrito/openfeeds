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

interface EmailFrameProps {
  preview: string;
  children: React.ReactNode;
  footerText?: string;
  showUnsubscribe?: boolean;
}

export const EmailFrame = ({
  preview,
  children,
  footerText,
  showUnsubscribe = false,
}: EmailFrameProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{preview}</Preview>
      <Container style={container}>
        <Section style={logoContainer}>
          <Img
            src="https://openfeeds.app/logo.png"
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
              <Link href="https://openfeeds.app/unsubscribe" style={unsubscribe}>
                Unsubscribe
              </Link>
            )}
          </>
        )}
      </Container>
    </Body>
  </Html>
);
