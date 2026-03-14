import { Heading, Text } from '@react-email/components';
import { EmailFrame } from './components/email-frame';
import { h1 as h1Base, textLeft, textSmall } from './styles';

export interface FeedbackReplyProps {
  message?: string;
}

export function FeedbackReply({ message }: FeedbackReplyProps) {
  return (
    <EmailFrame
      preview="Thanks for your feedback on OpenFeeds"
      footerText="OpenFeeds · Built for readers who value their time"
    >
      <Heading style={h1}>Thanks for your feedback</Heading>
      <Text style={textLeft}>Hey,</Text>
      <Text style={textLeft}>
        Thanks for reaching out and for using OpenFeeds. We appreciate you taking the time to let us
        know.
      </Text>
      {message && <Text style={messageBlock}>{message}</Text>}
      <Text style={textLeft}>
        If you have any other questions or run into anything else, don't hesitate to reply to this
        email.
      </Text>
      <Text style={textLeft}>
        Thanks again,
        <br />
        Cyrill
      </Text>
      <Text style={textSmall}>You're receiving this because you contacted OpenFeeds support.</Text>
    </EmailFrame>
  );
}

export default FeedbackReply;

FeedbackReply.PreviewProps = {
  message:
    'The issue you reported with feed sync has been resolved and will be available in the next update.',
} as FeedbackReplyProps;

const h1 = { ...h1Base, margin: '0 0 24px' };

const messageBlock = {
  color: '#2e2e2e',
  fontSize: '15px',
  lineHeight: '26px',
  margin: '0 0 16px',
  padding: '16px 20px',
  backgroundColor: '#fafafa',
  borderRadius: '8px',
  borderLeft: '3px solid #f76f53',
};
