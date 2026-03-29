#!/usr/bin/env tsx

/**
 * Send a courtesy feedback reply email to a user.
 *
 * Usage: pnpm send-reply <email> [message]
 * Example: pnpm send-reply user@example.com "The feed sync issue has been fixed and will be in the next update."
 *
 * If no message is provided, sends a generic "thanks for your feedback" email.
 */
import { Resend } from 'resend';
import { FeedbackReply } from './emails/feedback-reply';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY environment variable');
  process.exit(1);
}

const email = process.argv[2];
const message = process.argv[3];

if (!email) {
  console.error('Usage: pnpm send-reply <email> [message]');
  console.error('Example: pnpm send-reply user@example.com "Your issue with X has been fixed."');
  process.exit(1);
}

const FROM_EMAIL = 'OpenFeeds <hello@mail.openfeeds.app>';
const REPLY_TO = 'hello@openfeeds.app';

const resend = new Resend(RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: FROM_EMAIL,
  replyTo: REPLY_TO,
  to: email,
  subject: 'Thanks for your feedback',
  react: FeedbackReply({ message }),
});

if (error) {
  console.error('Failed to send email:', error.message);
  process.exit(1);
}

console.log(`\nEmail sent!`);
console.log(`  To: ${email}`);
console.log(`  ID: ${data?.id}`);
if (message) {
  console.log(`  Message: ${message}`);
} else {
  console.log(`  Message: (generic, no custom message)`);
}
