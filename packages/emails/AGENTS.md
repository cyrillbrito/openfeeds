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
import { render } from '@react-email/render';
import { ResetPassword } from '@repo/emails';

const html = await render(<ResetPassword resetUrl="..." />);
// Send via email provider (Resend, SendGrid, etc.)
```
