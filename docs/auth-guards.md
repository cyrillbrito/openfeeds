# Auth Guards & Route Protection

Route guards control access to protected and guest-only routes. They run in `beforeLoad` on SSR (first page load). On client-side SPA transitions and preloads, guards skip entirely — the session cookie is `httpOnly` and invisible to JS, so server middleware is the real security gate.

## Key Files

| File | Purpose |
| --- | --- |
| `apps/web/src/lib/guards.ts` | `hasSession`, `authGuard`, `guestGuard` |
| `apps/web/src/lib/auth-client.ts` | Better Auth client (`createAuthClient`) |
| `apps/web/src/server/auth.server.ts` | Better Auth server config (cookie cache, plugins) |
| `apps/web/src/server/middleware/auth.ts` | Auth middleware for server functions and API routes |
| `apps/web/src/lib/collection-errors.ts` | Shape stream error handler (401 → redirect to login) |

## How It Works

```
beforeLoad(ctx)
  └─ authGuard(ctx) / guestGuard(ctx)
       ├─ client? → skip (cookie is httpOnly, can't check)
       └─ server: auth.api.getSession({ headers })  — DB lookup, cookie cache (5 min)
```

### Guard Types

- **`authGuard(ctx)`** — Protected routes (`_frame`, `/`). Redirects to `/login` if no session. Preserves original path as `?redirect=` param.
- **`guestGuard(ctx)`** — Guest-only routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`). Redirects to `/` if session exists.

Both guards skip on client navigations.

### Why Guards Skip on the Client

Better Auth's session cookie uses `httpOnly` + `__Secure-` prefix in production, making it invisible to `document.cookie`. The alternatives each have problems:

- **`authClient.getSession()`** — HTTP request on every navigation. Exhausted Better Auth's rate limit (100 req / 10 s) with rapid navigation, causing 429 errors.
- **Internal nanostore atom** (`authClient.session`) — works at runtime but requires `as any` (not in public types), plus edge cases when the atom hasn't mounted.

Since the guards can't reliably check session state client-side, they skip entirely. Server middleware validates every data access point independently. This also means preloads (triggered by `defaultPreload: 'intent'` on link hover) are unaffected — guards no-op on the client regardless.

## Security Model

Guards are a **UX optimization for SSR**, not a security boundary. Three layers provide defense in depth:

1. **SSR (first load):** Guards call `auth.api.getSession()` — full session validation.
2. **Server functions:** `authMiddleware` validates session on every call. Throws `redirect({ to: '/login' })` if expired — TanStack Start propagates this to the client automatically.
3. **Electric shape proxies:** `authRequestMiddleware` returns 401. The `shapeErrorHandler` catches this and does `window.location.href = '/login'` (hard reload).

## Session Expiry Flows

### Server Function Call (expired session)

```
Client calls $$createFeeds() (or any server function with authMiddleware)
  → authMiddleware: auth.api.getSession() → null
  → throw redirect({ to: '/login', search: { redirect: '/feeds' } })
  → TanStack Start serializes redirect to client (framework-level)
  → Client router navigates to /login?redirect=/feeds
```

All entity server functions (`*.functions.ts`) use `authMiddleware`, so any mutation or query triggers this redirect.

### Electric Shape Stream (expired session)

```
ShapeStream polls /api/shapes/feeds
  → authRequestMiddleware: getSession() → null
  → Returns HTTP 401 { message: 'Unauthorized' }
  → Electric client creates FetchError(status=401)
  → shapeErrorHandler fires:
    → PostHog: 'auth:session_fail'
    → Toast: "Session expired. Redirecting to login…"
    → window.location.href = '/login' (hard reload)
    → Returns void → stops syncing permanently
```

### Sign-Out

```
User clicks "Sign Out" in UserMenu
  → authClient.signOut() → session cleared server-side
  → window.location.href = '/login' (hard reload)
  → SSR: guestGuard → no session → shows login page
```

### Client Navigation After Session Expires

```
Session expires while user is browsing
  → User clicks a link (client navigation)
  → authGuard skips (client-side)
  → Page renders
  → First server function call or shape stream poll:
    → Server function: authMiddleware redirects to /login
    → Shape stream: 401 → shapeErrorHandler → hard reload to /login
```

The worst case is one extra page render before the redirect. This is acceptable — the `httpOnly` cookie makes client-side detection impossible without an HTTP round-trip.

## Error Handling

- **Guards (server):** Catch `getSession` failures, report to PostHog, re-throw as `UnexpectedError`.
- **Guards (client):** No-op — `isServer` check returns immediately.
- **`functionErrorBoundary` (`start.ts`):** Global catch for server function errors. Does NOT interfere with redirects — TanStack Start processes redirects at the framework layer before this boundary.
- **`collectionErrorHandler`:** Wraps mutation handlers. Shows toast, reports to PostHog, re-throws for TanStack DB rollback. Does not handle auth errors (redirects are handled at the framework layer).
- **`shapeErrorHandler`:** Handles Electric shape errors. 401 → hard redirect to `/login`. Other errors → retry up to 2 times then stop.

## Better Auth Session Refresh

Better Auth's `useSession()` atom is kept fresh automatically:

| Trigger | Behaviour |
| --- | --- |
| Component mount (`useSession()`) | Fetches `/get-session` once |
| Window focus | Refetches (rate-limited to 5 s between fetches) |
| Coming back online | Refetches |
| Post-auth action (sign-in, sign-out, etc.) | Atom signal toggles → refetch |
| BroadcastChannel (cross-tab) | Atom signal toggles (no HTTP) |

### Rate Limits

Better Auth enables rate limiting in production: 100 requests per 10 seconds. Since guards make no HTTP requests on the client, only the `useSession()` atom's built-in refresh triggers count.

## Routes Using Guards

| Route | Guard |
| --- | --- |
| `/_frame` (layout) | `authGuard` |
| `/` (index) | `authGuard` |
| `/login` | `guestGuard` |
| `/signup` | `guestGuard` |
| `/forgot-password` | `guestGuard` |
| `/reset-password` | `guestGuard` |

## Login Flow (Email)

```
1. User visits /login (SSR)
2. guestGuard → server → auth.api.getSession() → null → shows login page
3. User submits credentials
4. authClient.signIn.email() → Better Auth sets session cookie
5. navigate({ to: search.redirect || '/' })
6. authGuard → client → skips → page renders
7. Server functions and shapes validate session on first call
```

## Login Flow (Social)

```
1. User visits /login (SSR)
2. guestGuard → server → no session → shows login page
3. User clicks "Continue with Google/Apple"
4. Full-page redirect to provider → callback → full-page reload
5. SSR: authGuard → server → session exists → allows
```

## Sign-Out Flow

```
1. User clicks "Sign Out" in UserMenu
2. authClient.signOut() → session cleared
3. window.location.href = '/login' (hard reload)
4. SSR: guestGuard → server → no session → shows login page
```

## All Auth Redirect Paths

| Trigger | Mechanism | Redirect Type | File |
| --- | --- | --- | --- |
| SSR navigation, no session | `authGuard` → `hasSession()` server | TanStack Router redirect | `guards.ts` |
| Server function, no session | `authMiddleware` → `redirect()` | TanStack Start framework-level | `middleware/auth.ts` |
| Shape stream, no session | `authRequestMiddleware` → 401 → `shapeErrorHandler` | `window.location.href` (hard) | `collection-errors.ts` |
| Sign out | `authClient.signOut()` | `window.location.href` (hard) | `UserMenu.tsx` |
| SSR guest page, has session | `guestGuard` → `hasSession()` server | TanStack Router redirect | `guards.ts` |
| Client navigation | Guards skip | Deferred to server function/shape | `guards.ts` |
