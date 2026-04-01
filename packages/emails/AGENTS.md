# Emails Package

Transactional email templates using [@react-email/components](https://react.email).

## Build System

This package uses **tsdown** to pre-compile React components before other packages import them.

**Why?** The main app uses SolidJS, which has its own JSX transform. Without pre-building, Vite would transform React Email's JSX with SolidJS's transform, causing runtime errors. By pre-compiling with tsdown, the JSX is already converted to plain JS function calls, eliminating any JSX conflicts.

## Commands

```bash
bun dev    # Preview emails at localhost:3002
bun build  # Pre-compile templates with tsdown (required before other packages can import)
bun export # Export to static HTML files
```

## Structure

- `emails/index.ts` - Package entry point, exports all email components
- `emails/components/` - Shared components (EmailFrame)
- `emails/styles.ts` - Shared styles
- `emails/*.tsx` - Email templates

## Usage

Components are exported pre-compiled from the package root:

```tsx
import { ResetPassword } from '@repo/emails';

// With Resend - pass React element directly (Resend handles rendering)
await resend.emails.send({
  from: 'OpenFeeds <hello@mail.openfeeds.app>',
  to: email,
  subject: 'Reset your password',
  react: ResetPassword({ resetUrl: '...' }),
});
```

## Template Types

### Transactional (app-triggered)

Used by `@repo/domain` for user actions (verification, password reset). These are exported from `emails/index.ts` and sent programmatically.

1. Create template in `emails/my-template.tsx`
2. Export from `emails/index.ts`
3. Run `bun build` to compile

### Broadcast (manually-triggered)

Marketing/announcement emails sent to Resend segments. These are **not** exported from `index.ts` — they're used by the `send-broadcast` script in `packages/scripts/`.

1. Create template in `emails/my-template.tsx`
2. Export a `subject` string from the template
3. Preview with `bun dev` (localhost:3002)
4. Create draft: `bun create-broadcast <email-name>`, then review and send from the Resend dashboard

Broadcast templates should:

- Pass `showUnsubscribe` to `EmailFrame` (unsubscribe URL is handled internally via Resend's `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder)
- Include UTM parameters on CTA links (`utm_source=email&utm_medium=broadcast&utm_campaign=<name>`)

Example:

```tsx
export const subject = 'My broadcast subject line';

export default function MyBroadcast() {
  return (
    <EmailFrame preview="..." showUnsubscribe>
      {/* content */}
      <Button href="https://openfeeds.app?utm_source=email&utm_medium=broadcast&utm_campaign=my_campaign">
        CTA
      </Button>
    </EmailFrame>
  );
}
```

## Static Assets

Email assets (logos, images) are hosted in the marketing app at `apps/marketing/public/_emails/`. Reference them with absolute URLs:

```tsx
<Img src="https://openfeeds.app/_emails/logo.png" />
```

This `/_emails/` path is excluded from Cloudflare's Astro adapter routing, ensuring direct static file serving.
