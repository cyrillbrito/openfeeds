# Auth Guards & Route Protection

`apps/web/` is an SPA. Route guards run on the client in `beforeLoad` and act as a **UX optimization** — they redirect users to `/login` (or away from guest-only pages) before the protected layout starts loading. The session cookie is `httpOnly`, so the server app (`apps/server/`) is the real security boundary.

## Key Files

- `apps/web/src/lib/session.ts` — `getSessionOnce()` memoized session fetch + `setSession()`/`invalidateSession()` helpers
- `apps/web/src/lib/guards.ts` — `authGuard(location?)`, `guestGuard()`
- `apps/web/src/lib/collection-errors.ts` — Electric shape stream error handler (401 → redirect to login)
- `apps/server/src/middleware/auth.ts` — auth middleware applied to every protected server route

## How It Works

```
beforeLoad(ctx)
  └─ authGuard(ctx.location) / guestGuard()
       └─ await getSessionOnce()
            ├─ first call on cold load → GET /api/auth/get-session (one round-trip)
            └─ subsequent calls → memoized promise
```

- **`authGuard(location?)`** — protected routes (`_frame`, `/`). Redirects to `/login?redirect=<path>` if no session.
- **`guestGuard()`** — guest-only routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`). Redirects to `/` if session exists.

## Session Cache

`apps/web/src/lib/session.ts` exports a module-level memoized promise. The session is fetched exactly **once per page load**, then reused by every guard, layout, and component that needs it.

- **`getSessionOnce()`** — returns the cached promise (or creates it on first call).
- **`setSession(session)`** — seed the cache after login/signup so the next navigation has no extra round-trip.
- **`invalidateSession()`** — clear the cache (used by sign-out, then followed by a hard reload).

Without this cache, N protected routes on cold load = N parallel `/api/auth/get-session` requests.

## Security Model

Guards are a **UX optimization**, not a security boundary. Real enforcement happens server-side:

1. **api routes:** `requireAuthMiddleware` validates on every protected call; missing/expired session → 401 with `{ message }`.
2. **Electric shape proxies:** the `/api/shapes/<table>` proxy validates the cookie and scopes by `user_id`; missing/expired session → 401, the shape stream's error handler reacts.
3. **Client guards:** prevent the user from briefly seeing an authenticated layout while a request is in flight.

A user with browser devtools can bypass the client guards, but every api response they get back will be 401.

## Session Expiry Flows

**api call (expired session):**
Client calls any api route → `requireAuthMiddleware` returns 401 → `unwrap()` throws → the caller surfaces the error (toast) and, where appropriate, navigates to `/login?redirect=<path>`.

**Electric shape stream (expired session):**
ShapeStream polls proxy → proxy returns 401 → `shapeErrorHandler` fires → toast + `window.location.href = '/login'` (hard reload).

**Sign-out:**
`authClient.signOut()` → `invalidateSession()` → `window.location.href = '/login'` (hard reload).

**Client navigation after session expires:**
Guard reads the stale cached session and lets the navigation through → first api call or shape poll triggers the 401 path. Worst case: one extra render before redirect. Acceptable for a UX-only guard.

## Error Handling

- **Guards:** await `getSessionOnce()`. Failures (network, 500 from `/api/auth/get-session`) propagate as thrown errors — TanStack Router's error boundary handles them.
- **`shapeErrorHandler`:** 401 → hard redirect to `/login`; other errors → retry up to 2× then stop.

## Routes

- `/_frame` (layout), `/` (index) → `authGuard`
- `/login`, `/signup`, `/forgot-password`, `/reset-password` → `guestGuard`
