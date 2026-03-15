# Onboarding Emails

Automated email sequences sent to app users after signup to drive activation and retention.

## Decision: Chained Delayed Jobs via BullMQ + Resend

**Why this approach:**

- Reuses existing infrastructure (BullMQ, Resend, React Email templates)
- No external dashboard/workflow tool — full control in code, AI-iterable
- Chained jobs: each job sends its email, then enqueues the next step — timing and logic changes affect all users, not just new ones
- Conditions checked at send time — logic lives in the worker function, not in declarative config

**Why chained (not pre-queued):**

- Changing delays or adding/removing steps affects users already in the sequence
- Each step decides whether to continue the chain — natural place for skip/branch logic
- No orphaned jobs if the sequence definition changes
- Simpler mental model: one job at a time per user

**Why not PostHog Workflows:**

- Requires separate email sender (PostHog sends emails itself, not via Resend)
- Separate DNS verification, unproven deliverability
- Two email systems to maintain
- Template editor is basic compared to React Email
- Less control — can't iterate with AI as easily

## Architecture

### Steps Are Numbered, Not Named by Content

Steps are generic stages: `onboarding-1`, `onboarding-2`, `onboarding-3`, etc. The content sent at each stage depends entirely on the user's state at that moment — a step is not tied to a specific email.

For example, `onboarding-1` might send a welcome email for most users, but if a user already imported feeds via OPML during signup, it could send a "here's what you can do next" email instead.

The exception is `comeback` — a special step for re-engaging inactive users, separate from the numbered sequence.

```ts
const ONBOARDING_STEPS = ['onboarding-1', 'onboarding-2', 'onboarding-3', 'comeback'] as const;
type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
```

### Job Data

Each job carries the user ID and current step:

```ts
interface OnboardingEmailJobData {
  userId: string;
  step: OnboardingStep;
}
```

### Worker Logic

All decisions live in the worker function. Each numbered step queries the user's current state and decides what to send:

```ts
async function processOnboardingEmail(job: Job<OnboardingEmailJobData>) {
  const { userId, step } = job.data;
  const user = await getUserOnboardingState(userId);

  // User deleted or unsubscribed — stop the chain
  if (!user || user.unsubscribed) return;

  switch (step) {
    case 'onboarding-1': {
      // First touch — welcome, but adapt based on what they've already done
      if (user.feedCount > 0) {
        await sendOnboardingEmail(user.email, 'OnboardingExploreFeatures', {
          subject: "You're off to a great start",
          props: { name: user.name, feedCount: user.feedCount },
        });
      } else {
        await sendOnboardingEmail(user.email, 'OnboardingWelcome', {
          subject: 'Welcome to OpenFeeds',
          props: { name: user.name },
        });
      }
      enqueueOnboardingEmail(userId, 'onboarding-2', { delay: 2 * DAY });
      break;
    }

    case 'onboarding-2': {
      // Second touch — depends on activation level
      if (user.feedCount === 0) {
        await sendOnboardingEmail(user.email, 'OnboardingAddFeeds', {
          subject: 'Your feed reader is waiting',
          props: { name: user.name },
        });
      } else if (user.feedCount > 0 && user.articlesRead === 0) {
        await sendOnboardingEmail(user.email, 'OnboardingStartReading', {
          subject: 'You have unread articles',
          props: { name: user.name, unreadCount: user.unreadCount },
        });
      } else {
        // User is active — skip, but still chain
      }
      enqueueOnboardingEmail(userId, 'onboarding-3', { delay: 3 * DAY });
      break;
    }

    case 'onboarding-3': {
      // Third touch — tips for engaged users, nudge for inactive
      if (user.feedCount > 3 && user.articlesRead > 10) {
        await sendOnboardingEmail(user.email, 'OnboardingPowerTips', {
          subject: 'Pro tips for power readers',
          props: { name: user.name },
        });
      } else if (user.feedCount > 0) {
        await sendOnboardingEmail(user.email, 'OnboardingTips', {
          subject: 'Get more from your feeds',
          props: { name: user.name },
        });
      } else {
        // Still no feeds — last nudge
        await sendOnboardingEmail(user.email, 'OnboardingLastNudge', {
          subject: "We're here when you're ready",
          props: { name: user.name },
        });
      }
      enqueueOnboardingEmail(userId, 'comeback', { delay: 7 * DAY });
      break;
    }

    case 'comeback': {
      // Special: re-engage users who dropped off
      if (user.lastActiveWithinDays(3)) return; // Active — no need
      if (user.feedCount === 0) return; // Never engaged — let them go

      await sendOnboardingEmail(user.email, 'OnboardingComeback', {
        subject: "You're missing great articles",
        props: { name: user.name, missedCount: user.unreadCount },
      });
      // End of chain
      break;
    }
  }
}
```

**Key points:**

- Steps are stages, not emails — `onboarding-2` might send completely different content to different users
- The switch/case IS the logic — no separate config to maintain
- Each case decides what to send (or skip) AND whether to chain to the next step
- Adding a new template doesn't require a new step — just a new branch within an existing step
- The `comeback` step has its own stop conditions separate from the numbered sequence

### User State Query

A single query provides all the data each step needs to make decisions:

```ts
async function getUserOnboardingState(userId: string) {
  // Returns: { email, name, feedCount, articlesRead, unreadCount, lastActiveAt, ... }
}
```

This query can grow over time as branching logic gets more sophisticated — more fields, same function.

### Flow

```
User signs up
  → auth hook: user.create.after
  → enqueueOnboardingEmail(userId, 'onboarding-1', { delay: 0 })

Worker picks up 'onboarding-1'
  → check user state
  → user has feeds? send "explore features" : send "welcome"
  → enqueueOnboardingEmail(userId, 'onboarding-2', { delay: 2 days })

2 days later, worker picks up 'onboarding-2'
  → check user state
  → no feeds? send "add feeds" nudge
  → has feeds but no reads? send "start reading"
  → active? skip email
  → enqueueOnboardingEmail(userId, 'onboarding-3', { delay: 3 days })

3 days later, worker picks up 'onboarding-3'
  → check user state
  → power user? send "pro tips"
  → casual? send "tips"
  → never engaged? send "last nudge"
  → enqueueOnboardingEmail(userId, 'comeback', { delay: 7 days })

7 days later, worker picks up 'comeback'
  → active recently? stop
  → never had feeds? stop
  → otherwise send "comeback" email
  → end of chain
```

### What We Track

**Start with nothing.** BullMQ tracks job state. The chain is self-managing.

**Add a `sent_emails` table later if needed:**

```sql
CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  email_key TEXT NOT NULL,        -- 'onboarding-1', 'onboarding-2', 'comeback'
  template TEXT NOT NULL,          -- which template was actually sent (for branched emails)
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX sent_emails_user_id_idx ON sent_emails(user_id);
CREATE UNIQUE INDEX sent_emails_user_email_key_idx ON sent_emails(user_id, email_key);
```

This gives you: audit log, deduplication, query capability, and the ability to see which branch each user went through.

## Implementation Plan

### Phase 1: Foundation (minimal, start here)

**Files to create/modify:**

| File                                            | Action | Description                                                                  |
| ----------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `packages/emails/emails/onboarding-welcome.tsx` | Create | First email template                                                         |
| `packages/emails/emails/index.ts`               | Modify | Export new template                                                          |
| `packages/domain/src/onboarding-emails.ts`      | Create | Step type, worker logic, user state query, enqueue function                  |
| `packages/domain/src/config.ts`                 | Modify | Add `ONBOARDING_EMAIL` queue name                                            |
| `packages/domain/src/queues.ts`                 | Modify | Add queue getter + `enqueueOnboardingEmail()`                                |
| `packages/domain/src/email.ts`                  | Modify | Add generic `sendOnboardingEmail()`                                          |
| `packages/domain/src/index.ts`                  | Modify | Export new module                                                            |
| `apps/worker/src/workers.ts`                    | Modify | Add onboarding email worker                                                  |
| `apps/worker/src/index.ts`                      | Modify | Register new worker                                                          |
| `apps/web/src/server/auth.ts`                   | Modify | Call `enqueueOnboardingEmail(userId, 'onboarding-1')` in `user.create.after` |

**For Phase 1, the worker is just:**

```ts
case 'onboarding-1': {
  await sendOnboardingEmail(user.email, 'OnboardingWelcome', {
    subject: 'Welcome to OpenFeeds',
    props: { name: user.name },
  });
  // No chaining yet — just the first email
  break;
}
```

One template, one job, prove the pipeline end-to-end.

### Phase 2: Add Chaining + More Templates

- Add 1-2 more templates
- Wire up chaining: `onboarding-1` → `onboarding-2` → `onboarding-3`
- Add basic branching (check `feedCount` to decide what to send)

### Phase 3: Smart Branching + Comeback

- Expand `getUserOnboardingState()` with more fields
- Add variant templates for different user activation levels
- Add the `comeback` step with its own stop conditions

### Phase 4: Tracking Table

- Add `sent_emails` table via migration
- Insert row on successful send
- Useful for debugging and analytics ("which template did user X actually receive at step 2?")

### Phase 5: Beyond Onboarding

Same infrastructure, different triggers:

- **Re-engagement:** Cron-triggered ("users inactive for 2 weeks")
- **Feature announcements:** Bulk enqueue to active users
- **Usage milestones:** Event-triggered from domain code

The queue, worker, templates, and send functions are all reusable.

## Key Design Decisions

### Why steps are numbered, not content-named

- `onboarding-2` is a stage, not an email — it can send different content to different users
- Adding a new branching condition doesn't require a new step
- Steps represent "touchpoints in time," not "specific messages"
- The `comeback` step is special because it has different stop/skip semantics (only for inactive users)

### Why chained (not pre-queued)

- Changing delays affects users mid-sequence (not just new users)
- Adding/removing steps doesn't leave orphaned jobs
- Each step naturally decides whether to continue
- Only one pending job per user at any time

### Why logic in the worker (not in sequence config)

- Skip conditions, branching, template selection are just code
- No DSL to learn or maintain
- Easy to add complex conditions (DB queries, feature flags, etc.)
- AI can iterate on a switch/case directly

### Why check conditions at send time

- User state changes between signup and day 5
- Fresh DB query means decisions reflect current reality
- If user added feeds on day 3, the day 5 "add feeds" email correctly skips

### Redis persistence risk

- Only one pending job per user at any time (the next step in the chain)
- If Redis flushes, that one job is lost — user just stops getting onboarding emails
- Acceptable: this is nice-to-have, not critical
- If concerning: add tracking table + catch-up cron that re-enqueues the next step for users who stalled

## Template Conventions

Onboarding templates follow existing patterns but use `showUnsubscribe` since they're marketing-adjacent:

```tsx
// packages/emails/emails/onboarding-welcome.tsx
export function OnboardingWelcome({ name }: { name?: string }) {
  return (
    <EmailFrame preview="Welcome to OpenFeeds" showUnsubscribe>
      <Heading style={h1}>Welcome{name ? `, ${name}` : ''}!</Heading>
      <Text style={text}>...</Text>
      <Button
        style={button}
        href="https://openfeeds.app?utm_source=email&utm_medium=onboarding&utm_campaign=onboarding-1"
      >
        Start Reading
      </Button>
    </EmailFrame>
  );
}
```

- Use `showUnsubscribe` on all onboarding emails
- Include UTM parameters: `utm_source=email&utm_medium=onboarding&utm_campaign={step_key}`
- Accept props for personalization (name, feed count, etc.)
- Export from `emails/index.ts` as transactional (they're programmatically sent)
- Multiple templates can exist for the same step (branching picks the right one at send time)
