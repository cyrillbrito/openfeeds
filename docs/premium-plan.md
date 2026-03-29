# Premium Plan Implementation

Research document covering how to introduce paid tiers to OpenFeeds.

## Table of Contents

1. [Current State](#current-state)
2. [Implementation Approach](#implementation-approach)
3. [Stage 1 — Manual Premium Flag (Quick Win)](#stage-1--manual-premium-flag-quick-win)
4. [Stage 2 — Payment Provider Integration](#stage-2--payment-provider-integration)
5. [Payment Provider Comparison](#payment-provider-comparison)
6. [Better Auth Integration Details](#better-auth-integration-details)
7. [Database Changes](#database-changes)
8. [Codebase Changes](#codebase-changes)
9. [Things to Be Careful About](#things-to-be-careful-about)
10. [Recommendation](#recommendation)

---

## Current State

All users share the same static limits defined in `packages/domain/src/limits.schema.ts`:

| Resource            | Limit             |
| ------------------- | ----------------- |
| Feed subscriptions  | 200               |
| Filter rules        | 10                |
| Saved articles      | 100               |
| Content extractions | 30/day, 450/month |
| TTS generations     | 5/day, 30/month   |

Limits are enforced in domain functions via `FREE_TIER_LIMITS` constant lookups:

- `packages/domain/src/entities/feed.ts:47-56` — feed creation
- `packages/domain/src/entities/filter-rule.ts:19-27` — filter rule creation
- `packages/domain/src/entities/article.ts:61-81` — extraction rate limits
- `packages/domain/src/entities/article.ts:166-174` — saved article creation
- `packages/domain/src/import.ts:83-105` — OPML import
- `packages/domain/src/tts.ts:145-160` — TTS rate limits

The counting functions live in `packages/domain/src/limits.ts`. There is **no per-user override**, no plan column, no billing/payment code anywhere.

The comment in `limits.schema.ts:5-6` already anticipates this:

> "When paid plans are introduced, these will be replaced by per-user limits based on their subscription tier."

---

## Implementation Approach

Two stages. Stage 1 is a quick manual flag for immediate use (make yourself unlimited). Stage 2 is a real payment integration.

---

## Stage 1 — Manual Premium Flag (Quick Win)

Goal: Add a `plan` column to the `user` table so you can manually toggle premium for any user via the database.

### Schema change

Add a `plan` text column to the `user` table with default `'free'`:

```typescript
// packages/db/src/schema/auth.ts
export const user = pgTable('user', {
  // ...existing columns
  plan: text('plan').notNull().default('free'), // 'free' | 'pro'
});
```

Generate migration: `pnpm -C packages/db drizzle-kit generate --name add-user-plan-column`

### Domain changes

**1. Define plan limits (`packages/domain/src/limits.schema.ts`):**

```typescript
export type Plan = 'free' | 'pro';

export const PLAN_LIMITS: Record<Plan, typeof FREE_TIER_LIMITS> = {
  free: FREE_TIER_LIMITS,
  pro: {
    feeds: Infinity,
    filterRules: Infinity,
    savedArticles: Infinity,
    extractionsPerDay: Infinity,
    extractionsPerMonth: Infinity,
    ttsPerDay: Infinity,
    ttsPerMonth: Infinity,
  },
};
```

Using `Infinity` means "unlimited" — the comparison `currentCount >= Infinity` is always `false`, so limits never trigger. Alternatively use `-1` as sentinel and check explicitly.

**2. Add plan to domain context (`packages/domain/src/domain-context.ts`):**

```typescript
export interface DomainContext {
  userId: string;
  conn: Db | Transaction;
  plan: Plan; // NEW
}
```

**3. Update limit checks to use `ctx.plan`:**

Every limit enforcement site changes from:

```typescript
if (currentCount + data.length > FREE_TIER_LIMITS.feeds) {
  throw new LimitExceededError('feeds', FREE_TIER_LIMITS.feeds);
}
```

to:

```typescript
const limits = PLAN_LIMITS[ctx.plan];
if (currentCount + data.length > limits.feeds) {
  throw new LimitExceededError('feeds', limits.feeds);
}
```

**4. Thread plan through from auth:**

In server functions, the auth middleware already provides `context.user`. After adding the `plan` column, `context.user.plan` is available. Pass it when creating domain contexts:

```typescript
// apps/web/src/entities/feeds.functions.ts
return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
  await feedsDomain.createFeeds(ctx, data);
  return { txid: await getTxId(ctx.conn) };
});
```

`withTransaction` and `createDomainContext` signatures gain a `plan` parameter.

**5. Update `getUserUsage` to return plan-aware limits:**

```typescript
export async function getUserUsage(userId: string, plan: Plan): Promise<UserUsage> {
  const limits = PLAN_LIMITS[plan];
  // ...same counting queries...
  return {
    feeds: { used: feedCount, limit: limits.feeds },
    // ...
  };
}
```

**6. Update `LimitExceededError` message:**

```typescript
// Change "on the free plan" to be plan-aware
super(`You've reached the maximum of ${limit} ${resource}. Upgrade your plan for higher limits.`);
```

### How to make yourself unlimited

After deploying Stage 1:

```sql
UPDATE "user" SET plan = 'pro' WHERE email = 'your@email.com';
```

That's it. All limit checks will use pro limits (unlimited).

### Files to change (Stage 1)

| File                                                 | Change                                 |
| ---------------------------------------------------- | -------------------------------------- |
| `packages/db/src/schema/auth.ts`                     | Add `plan` column to `user` table      |
| `packages/domain/src/limits.schema.ts`               | Add `Plan` type, `PLAN_LIMITS` map     |
| `packages/domain/src/domain-context.ts`              | Add `plan` to context interfaces       |
| `packages/domain/src/limits.ts`                      | Update `getUserUsage` to accept `plan` |
| `packages/domain/src/entities/feed.ts`               | Use `PLAN_LIMITS[ctx.plan]`            |
| `packages/domain/src/entities/filter-rule.ts`        | Same                                   |
| `packages/domain/src/entities/article.ts`            | Same (extractions + saved articles)    |
| `packages/domain/src/tts.ts`                         | Same                                   |
| `packages/domain/src/import.ts`                      | Same                                   |
| `packages/domain/src/errors.ts`                      | Update error message                   |
| `apps/web/src/routes/_frame.settings.usage.tsx`      | Show plan-aware limits                 |
| Every `withTransaction` / `createDomainContext` call | Pass `plan`                            |

---

## Stage 2 — Payment Provider Integration

### Patterns for premium features

Four common patterns, ordered by complexity:

**A. Boolean flag** — `isPremium: boolean`. Simplest but zero granularity. Hard to extend.

**B. Plan/tier enum** — `plan: 'free' | 'pro' | 'business'`. Maps to a limits object. **Best fit for OpenFeeds.** RSS readers have clear tier boundaries. Easy to reason about, show on pricing page, and compare.

**C. Entitlements** — `Set<'feeds:unlimited' | 'tts:enabled'>`. Per-feature granularity. Overkill for a product with < 5 billable features.

**D. Usage-based** — Meter consumption, bill per unit. Unpredictable revenue, complex to implement, users dislike uncertain costs. Only makes sense for AI/TTS if priced per-minute.

**Recommendation: Plan/tier enum (B).** Stage 1 already implements this. Stage 2 just wires it to a payment provider.

---

## Payment Provider Comparison

### Stripe

**What it is:** The industry-standard payment processor. Not a Merchant of Record — you are the legal seller.

**Better Auth integration:** First-party `@better-auth/stripe` plugin. Most mature.

**What the plugin provides:**

- Auto-creates Stripe customer on signup
- Adds `subscription` table with full lifecycle fields (status, period, cancellation, trial)
- Adds `stripeCustomerId` to `user` table
- Plan definitions with `limits` objects baked in
- Client methods: `subscription.upgrade()`, `.cancel()`, `.restore()`, `.billingPortal()`
- Auto webhook handling at `/api/auth/stripe/webhook`
- Lifecycle hooks: `onSubscriptionComplete`, `onSubscriptionCreated`, `onSubscriptionUpdate`, `onSubscriptionCancel`, `onSubscriptionDeleted`
- Trial abuse prevention (one trial per account ever)
- Seat-based billing, scheduled plan changes, proration
- Supports `allow_promotion_codes`, `automatic_tax`, `tax_id_collection`

**Pricing:**

- 2.9% + 30c per transaction
- No monthly fee
- Tax compliance is YOUR responsibility (Stripe Tax adds 0.5% and only calculates — doesn't file)

**Pros:**

- Battle-tested, massive ecosystem
- Maximum flexibility and control
- First-party Better Auth plugin with excellent coverage
- Lowest base transaction fee
- Stripe Billing Portal for customer self-service
- 135+ currencies, 40+ payment methods

**Cons:**

- **Not a Merchant of Record** — you must register for VAT/GST/sales tax in every jurisdiction where you have nexus, file returns, and remit taxes yourself
- EU VAT MOSS/OSS filing required for EU consumers
- US economic nexus thresholds vary by state
- Need accountant + tax advisor for international sales
- More operational burden for a solo developer
- Adds schema to your database (subscription table + user column)

---

### Polar

**What it is:** Merchant of Record billing platform built for developers. Open source (Apache 2.0). Handles all global tax compliance.

**Better Auth integration:** `@polar-sh/better-auth` adapter with sub-plugins: `checkout`, `portal`, `usage`, `webhooks`.

**Also has:** a TanStack Start adapter (listed in their framework docs).

**What the adapter provides:**

- Checkout flow (slug-based product references)
- Hosted customer portal (orders, subscriptions, benefits management)
- Usage-based billing with event ingestion + customer meters
- 25+ typed webhook handlers (`onOrderPaid`, `onSubscriptionCanceled`, `onCustomerStateChanged`, etc.)
- Uses `externalId` mapping (your `user.id`) — no schema changes to your DB

**Pricing:**

- 4% + 40c per transaction (includes Stripe's fee underneath)
- +1.5% for international cards (non-US)
- +0.5% for subscription payments
- $15 per chargeback
- Payout fees: $2/month + 0.25% + 25c per payout

Real-world cost for an international subscription: ~6% + 40c total.

**Pros:**

- **Merchant of Record** — handles ALL tax globally (registration, collection, filing, remittance)
- Better Auth adapter + TanStack Start adapter
- **No DB schema changes** — Polar stores everything on their side
- Open source
- Built-in usage-based billing (great for TTS/AI features if ever priced per-use)
- Hosted customer portal (no UI to build)
- Automated benefits (license keys, GitHub repo access, Discord roles)
- Modern SDK, developer-first DX

**Cons:**

- Younger platform, less battle-tested than Stripe
- Higher effective transaction cost (~6% for international subs)
- Less flexibility/customization than raw Stripe
- Smaller ecosystem, less third-party tooling
- Less control over checkout experience
- Payout fees add up

---

### Lemon Squeezy

**What it is:** Merchant of Record platform, older and more established than Polar. More focused on digital products than SaaS.

**Better Auth integration:** None. Would require manual webhook integration.

**Pricing:** 5% + 50c per transaction (most expensive).

**Pros:**

- Merchant of Record (handles all tax)
- PayPal support (unique among the three)
- Built-in email marketing, affiliate system
- More established than Polar
- 135+ countries, 20+ payment methods

**Cons:**

- **No Better Auth plugin** — significant manual integration work
- Most expensive fee structure
- No framework-specific adapters
- More focused on digital product sales than SaaS subscriptions
- Less developer-focused tooling
- Would need to build your own subscription status sync

**Not recommended for OpenFeeds.**

---

### Side-by-side

|                          | Stripe                   | Polar           | Lemon Squeezy    |
| ------------------------ | ------------------------ | --------------- | ---------------- |
| **Merchant of Record**   | No                       | Yes             | Yes              |
| **Tax handling**         | You handle it            | They handle it  | They handle it   |
| **Better Auth plugin**   | Yes (first-party)        | Yes (adapter)   | No               |
| **TanStack Start**       | Via Better Auth          | Direct adapter  | No               |
| **Base fee**             | 2.9% + 30c               | 4% + 40c        | 5% + 50c         |
| **True cost (intl sub)** | 2.9% + 30c + tax         | ~6% + 40c       | 5% + 50c         |
| **DB schema changes**    | Yes (subscription table) | No              | Manual           |
| **Customer portal**      | Stripe hosted            | Polar hosted    | Lemon hosted     |
| **Usage billing**        | Stripe Billing meters    | Built-in events | Built-in (newer) |
| **Maturity**             | Very high                | Medium          | High             |
| **Open source**          | No                       | Yes             | No               |

---

## Better Auth Integration Details

### Stripe Plugin Setup

```typescript
// apps/web/src/server/auth.ts
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY);

export const auth = betterAuth({
  // ...existing config
  plugins: [
    // ...existing plugins
    stripe({
      stripeClient,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: 'pro',
            priceId: 'price_xxx', // from Stripe Dashboard
            limits: {
              feeds: Infinity,
              filterRules: Infinity,
              savedArticles: Infinity,
              extractionsPerDay: Infinity,
              extractionsPerMonth: Infinity,
              ttsPerDay: Infinity,
              ttsPerMonth: Infinity,
            },
          },
        ],
      },
      onSubscriptionComplete: async ({ subscription, plan }) => {
        // Queue welcome email via BullMQ
      },
      onSubscriptionCancel: async ({ subscription }) => {
        // Queue churn notification
      },
    }),
  ],
});
```

Auth schema file (`apps/web/src/server/auth.schema.ts`) would also need updating to mirror the plugin setup for schema generation, then run `pnpm generate:auth-schema` + migration.

### Polar Plugin Setup

```typescript
// apps/web/src/server/auth.ts
import { polar } from '@polar-sh/better-auth';
import { checkout, portal, webhooks } from '@polar-sh/better-auth/plugins';
import { Polar } from '@polar-sh/sdk';

const polarClient = new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });

export const auth = betterAuth({
  // ...existing config
  plugins: [
    // ...existing plugins
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: 'prod_xxx', slug: 'pro-monthly' },
            { productId: 'prod_yyy', slug: 'pro-yearly' },
          ],
        }),
        portal(), // hosted customer management
        webhooks({
          secret: env.POLAR_WEBHOOK_SECRET,
          onSubscriptionCreated: async (payload) => {
            /* ... */
          },
          onSubscriptionCanceled: async (payload) => {
            /* ... */
          },
        }),
      ],
    }),
  ],
});
```

With Polar, no subscription table is needed in your DB — Polar stores subscriptions externally. You'd query subscription status via the Polar API or cache it. The plan check in domain functions would call Polar's API or use a cached value.

---

## Database Changes

### Stage 1 (manual flag)

One migration:

```sql
ALTER TABLE "user" ADD COLUMN "plan" text NOT NULL DEFAULT 'free';
```

No other tables needed. Generate with:

```bash
pnpm -C packages/db drizzle-kit generate --name add-user-plan-column
```

### Stage 2 with Stripe plugin

The Better Auth Stripe plugin auto-manages a `subscription` table. Schema generated via `pnpm generate:auth-schema`. Fields include:

- `id`, `plan`, `referenceId` (user ID), `stripeCustomerId`, `stripeSubscriptionId`
- `status` (active, trialing, canceled, past_due, incomplete, etc.)
- `periodStart`, `periodEnd`, `cancelAtPeriodEnd`, `canceledAt`, `endedAt`
- `seats`, `trialStart`, `trialEnd`, `billingInterval`, `stripeScheduleId`

Also adds `stripeCustomerId` to `user` table.

### Stage 2 with Polar

No database changes. Polar stores everything externally. You'd query subscription status via Polar SDK:

```typescript
const subscription = await polarClient.subscriptions.list({
  customerId: user.polarCustomerId,
  active: true,
});
```

Or use webhook events to update a local cache column (the `plan` column from Stage 1).

### Electric SQL consideration

The subscription/plan data is server-side only. It should NOT be synced to the client via Electric SQL — subscription status must be validated server-side to prevent tampering. The `plan` column on `user` can be read by the client for UI purposes (show upgrade prompts, display plan-aware limits in the usage page) but all enforcement must happen in domain functions on the server.

---

## Codebase Changes

Full list of changes needed, regardless of payment provider:

### Domain package (`packages/domain/`)

| File                                | What changes                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `src/limits.schema.ts`              | Add `Plan` type, `PLAN_LIMITS` map, update `UserUsage` to be plan-aware |
| `src/limits.ts`                     | `getUserUsage` accepts `plan`, returns plan-specific limits             |
| `src/domain-context.ts`             | Add `plan: Plan` to `DomainContext` and `TransactionContext`            |
| `src/entities/feed.ts:47-56`        | Use `PLAN_LIMITS[ctx.plan].feeds` instead of `FREE_TIER_LIMITS.feeds`   |
| `src/entities/filter-rule.ts:19-27` | Same pattern for filter rules                                           |
| `src/entities/article.ts:61-81`     | Same for extraction limits                                              |
| `src/entities/article.ts:166-174`   | Same for saved articles                                                 |
| `src/tts.ts:145-160`                | Same for TTS limits                                                     |
| `src/import.ts:83-105`              | Same for OPML import                                                    |
| `src/errors.ts:52-61`               | Update `LimitExceededError` message to not hardcode "free plan"         |
| `src/analytics.ts:65-88`            | Include `plan` in limit-hit analytics events                            |

### Web app (`apps/web/`)

| File                                   | What changes                                             |
| -------------------------------------- | -------------------------------------------------------- |
| `src/server/auth.ts`                   | Add Stripe or Polar plugin                               |
| `src/server/auth.schema.ts`            | Mirror plugin setup for schema generation                |
| `src/entities/*.functions.ts`          | Pass `plan` to `withTransaction` / `createDomainContext` |
| `src/routes/_frame.settings.usage.tsx` | Show plan-aware limits, add upgrade prompt               |
| New: pricing/upgrade page              | Route for plan selection + checkout                      |
| New: billing settings page             | Manage subscription, cancel, view invoices               |

### Worker (`apps/worker/`)

| File                                 | What changes                              |
| ------------------------------------ | ----------------------------------------- |
| Any job that creates domain contexts | Pass `plan` (look up user's plan from DB) |

### Database (`packages/db/`)

| File                 | What changes                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `src/schema/auth.ts` | Add `plan` column to `user` (Stage 1), or let Stripe plugin add `subscription` table (Stage 2) |

---

## Things to Be Careful About

### Tax compliance (biggest risk)

- **With Stripe (not MoR):** You are the legal seller. You must register for VAT/GST/sales tax in every jurisdiction you sell to. EU requires VAT MOSS/OSS filing for consumer sales. US has state-by-state economic nexus thresholds. Getting this wrong = penalties and back taxes.
- **With Polar/Lemon Squeezy (MoR):** They are the legal seller. They handle everything. You receive net payouts. Much simpler.
- **Bottom line:** If you're a solo developer, MoR is strongly recommended unless you have an accountant.

### Refunds

- Stripe does NOT refund transaction fees (you lose ~2.9% + 30c per refund).
- Polar: same — transaction fees are not returned.
- Have a clear refund policy before launching. Consider partial refunds for partial months.
- Build a refund flow (or rely on Stripe/Polar dashboard).

### Failed payments and grace periods

- Don't immediately cut off access on payment failure.
- Implement a 3-5 day grace period with email notifications.
- After grace period: downgrade to free, never delete data.
- Stripe has Smart Retries (auto-retries failed charges). Both Polar and Stripe send dunning emails.

```typescript
function isUserPremium(subscription: Subscription): boolean {
  if (subscription.status === 'active' || subscription.status === 'trialing') return true;

  // Grace period: 3 days after payment failure
  if (subscription.status === 'past_due') {
    const gracePeriodEnd = addDays(subscription.periodEnd, 3);
    return new Date() < gracePeriodEnd;
  }

  // Active until period actually ends for canceled subs
  if (subscription.status === 'canceled' && subscription.endedAt) {
    return new Date() < subscription.endedAt;
  }

  return false;
}
```

### Downgrade data handling

When a Pro user (unlimited feeds) downgrades to Free (200 feeds), what happens if they have 500 feeds?

**Recommended approach:** Allow downgrade, keep all existing data, prevent adding NEW feeds over the free limit. Users can still read all 500 feeds but can't add #501. Same for TTS, extractions, saved articles — keep existing, prevent new.

Never delete user data on downgrade.

### Plan grandfathering

When changing prices, existing subscribers keep their current price — Stripe and Polar both handle this naturally (price changes only apply to new subscriptions). If removing a plan, mark it as inactive in your config but keep serving existing subscribers.

```typescript
const PLANS = [
  { name: 'pro', priceId: 'price_new', active: true },
  { name: 'pro-legacy', priceId: 'price_old', active: false }, // hidden from pricing UI, still works
];
```

### Webhook reliability

- Store processed webhook event IDs to prevent duplicate processing (idempotency).
- Acknowledge webhooks immediately (200 response), process asynchronously via BullMQ.
- Stripe retries failed webhooks for 3 days.
- Don't assume events arrive in order — use event timestamps.
- Log every webhook for debugging.
- Both Better Auth plugins handle signature verification automatically.

### Local-first sync and plan status

Plan status should be checked server-side in domain functions. The client can read the `plan` column for UI display (showing upgrade prompts, rendering limits in settings) but the server is the authority. Users could manipulate client-side data if enforcement happened client-side.

The `plan` column can live on the `user` table (synced for display) or `settings` table. Write to it only from webhook handlers or manual DB updates.

### Webhook → plan sync

When using Polar (external storage), you need to sync plan status back to your DB. On webhook events (`onSubscriptionCreated`, `onSubscriptionCanceled`), update the `plan` column:

```typescript
onSubscriptionCreated: async (payload) => {
  await db.update(user)
    .set({ plan: 'pro' })
    .where(eq(user.id, payload.data.customer.externalId));
},
onSubscriptionCanceled: async (payload) => {
  await db.update(user)
    .set({ plan: 'free' })
    .where(eq(user.id, payload.data.customer.externalId));
},
```

### Apple App Store / Google Play

If the iOS/mobile app ever charges through app stores, they take 15-30% and have their own subscription management. Not relevant now but worth noting — don't build anything that would conflict with store policies if a mobile app is planned.

---

## Recommendation

### For Stage 1 (now)

Add `plan` column to user table, define `PLAN_LIMITS`, thread `plan` through domain context. Set yourself to `'pro'` manually. ~1 day of work.

### For Stage 2 (payment integration)

**Use Polar** for these reasons:

1. **MoR eliminates tax compliance** — as a solo/indie developer, handling global VAT/GST/sales tax is a massive operational burden. Polar handles all of it.

2. **Better Auth adapter exists** — `@polar-sh/better-auth` with checkout, portal, usage, and webhooks sub-plugins. Not as mature as the Stripe plugin but functional.

3. **No DB schema changes** — Polar stores subscriptions externally. The Stage 1 `plan` column + webhook sync is all you need on your side.

4. **TanStack Start adapter** — Polar lists TanStack Start as a supported framework.

5. **Hosted customer portal** — no billing management UI to build.

6. **Usage-based billing** — if TTS or AI features are ever priced per-use, Polar has built-in event ingestion and metering.

7. **Open source** — aligns with project ethos.

**When to choose Stripe instead:** If you incorporate a company in a single jurisdiction (e.g., US LLC) and primarily sell domestically, Stripe's lower fees and greater flexibility may justify the tax compliance overhead. Also if you need very customized checkout flows or advanced Stripe features (Connect, Invoicing, Revenue Recognition).

### Effort estimate

| Stage                 | Effort    | Scope                                                          |
| --------------------- | --------- | -------------------------------------------------------------- |
| Stage 1 (manual flag) | ~1 day    | Schema + domain changes + threading plan through context       |
| Stage 2 (Polar)       | ~3-5 days | Plugin setup, webhook handling, pricing page, billing settings |
| Stage 2 (Stripe)      | ~5-7 days | Same as Polar + subscription table migration + tax setup       |
