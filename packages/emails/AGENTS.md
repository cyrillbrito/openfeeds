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
  from: 'OpenFeeds <noreply@mail.openfeeds.app>',
  to: email,
  subject: 'Reset your password',
  react: ResetPassword({ resetUrl: '...' }),
});
```

## Adding New Templates

1. Create template in `emails/my-template.tsx`
2. Export from `emails/index.ts`
3. Run `bun build` to compile

## Static Assets

Email assets (logos, images) are hosted in the marketing app at `apps/marketing/public/_emails/`. Reference them with absolute URLs:

```tsx
<Img src="https://openfeeds.app/_emails/logo.png" />
```

This `/_emails/` path is excluded from Cloudflare's Astro adapter routing, ensuring direct static file serving.
