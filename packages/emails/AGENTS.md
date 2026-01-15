# Emails Package

Transactional email templates using [@react-email/components](https://react.email).

## Commands

```bash
bun dev    # Preview emails at localhost:3002
bun build  # Build templates
bun export # Export to HTML
```

## Structure

- `emails/components/` - Shared components (EmailFrame)
- `emails/styles.ts` - Shared styles
- `emails/*.tsx` - Email templates

## Usage

```tsx
import { ResetPassword } from '@repo/emails/emails/reset-password';

// With Resend
await resend.emails.send({
  from: 'OpenFeeds <noreply@openfeeds.app>',
  to: email,
  subject: 'Reset your password',
  react: ResetPassword({ resetUrl: '...' }),
});
```
