#!/usr/bin/env bun

/**
 * Create a draft broadcast in Resend from a React Email template.
 * Review, pick segment, and send from the Resend dashboard.
 *
 * Usage: bun create-broadcast <email-name>
 * Example: bun create-broadcast announcement
 *
 * The email template must export:
 * - component: React component
 * - subject: string
 */
import { existsSync } from 'node:fs';
import { render } from '@react-email/render';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY environment variable');
  process.exit(1);
}

const FROM_EMAIL = 'OpenFeeds <hello@mail.openfeeds.app>';
const REPLY_TO = 'hello@openfeeds.app';
const DEFAULT_SEGMENT_NAME = 'General';

const emailName = process.argv[2];

if (!emailName) {
  console.error('Usage: bun create-broadcast <email-name>');
  process.exit(1);
}

const templatePath = `./emails/${emailName}.tsx`;
if (!existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}

// Dynamic import of the email template
const emailModule = await import(`./emails/${emailName}`);

if (!emailModule.default) {
  console.error(`Template "${emailName}" must have a default export (React component)`);
  process.exit(1);
}

if (!emailModule.subject) {
  console.error(`Template "${emailName}" must export a "subject" string`);
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// Find the default segment
const { data: segmentsData, error: segmentsError } = await resend.segments.list();
if (segmentsError) {
  console.error('Failed to list segments:', segmentsError.message);
  process.exit(1);
}

const segment = segmentsData?.data.find(
  (s) => s.name.toLowerCase() === DEFAULT_SEGMENT_NAME.toLowerCase(),
);
if (!segment) {
  const available = segmentsData?.data.map((s) => s.name).join(', ') || 'none';
  console.error(`Default segment "${DEFAULT_SEGMENT_NAME}" not found. Available: ${available}`);
  process.exit(1);
}

// Render email to HTML and plain text
const html = await render(emailModule.default({}));
const text = await render(emailModule.default({}), { plainText: true });

// Create draft broadcast
const { data, error } = await resend.broadcasts.create({
  name: emailName,
  segmentId: segment.id,
  from: FROM_EMAIL,
  replyTo: REPLY_TO,
  subject: emailModule.subject,
  html,
  text,
});

if (error) {
  console.error('Failed to create broadcast:', error.message);
  process.exit(1);
}

console.log(`\nDraft broadcast created!`);
console.log(`  ID: ${data?.id}`);
console.log(`  Email: ${emailName}`);
console.log(`  Subject: ${emailModule.subject}`);
console.log(`\n→ Review and send from: https://resend.com/broadcasts`);
