# Auth Guards & Route Protection

Route guards run in `beforeLoad` on SSR only. On client navigations and preloads, they skip — the session cookie is `httpOnly` (invisible to JS), so server middleware is the real security gate.

## Key Files

- `src/lib/guards.ts` — `authGuard(location?)`, `guestGuard()`
- `src/server/has-session.server.ts` — server-only session check via Better Auth
- `src/server/middleware/auth.ts` — auth middleware for server functions and API routes
- `src/lib/collection-errors.ts` — shape stream error handler (401 → redirect to login)

## How It Works

```
beforeLoad(ctx)
  └─ authGuard(ctx.location) / guestGuard()
       ├─ client? → skip
       └─ server: hasSession() → auth.api.getSession({ headers })
```

- **`authGuard(location?)`** — protected routes (`_frame`, `/`). Redirects to `/login?redirect=<path>` if no session.
- **`guestGuard()`** — guest-only routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`). Redirects to `/` if session exists.

## Why Guards Skip on Client

Better Auth's session cookie uses `httpOnly` + `__Secure-` prefix in production. The alternatives each failed:

- `authClient.getSession()` — HTTP request per navigation, exhausted rate limit (100 req/10s)
- Internal nanostore atom (`authClient.session`) — untyped, requires `as any`, edge cases on mount

Guards skip entirely on client. Preloads (`defaultPreload: 'intent'`) are also unaffected since guards no-op on client regardless.

## Security Model

Guards are a **UX optimization for SSR**, not a security boundary. Three layers provide defense in depth:

1. **SSR (first load):** guards call `hasSession()` — full session validation
2. **Server functions:** `authMiddleware` validates on every call, throws `redirect({ to: '/login' })` if expired
3. **Electric shape proxies:** `authRequestMiddleware` returns 401, `shapeErrorHandler` does `window.location.href = '/login'`

## Session Expiry Flows

**Server function (expired session):**
Client calls any server function → `authMiddleware` finds no session → throws redirect → TanStack Start propagates to client → navigates to `/login?redirect=<path>`.

**Electric shape stream (expired session):**
ShapeStream polls proxy → `authRequestMiddleware` returns 401 → `shapeErrorHandler` fires → toast + `window.location.href = '/login'` (hard reload).

**Sign-out:**
`authClient.signOut()` → session cleared → `window.location.href = '/login'` (hard reload).

**Client navigation after session expires:**
Guard skips → page renders → first server function or shape poll triggers redirect. Worst case: one extra render before redirect.

## Error Handling

- **Guards (server):** catch `getSession` failures, report to PostHog, re-throw as `UnexpectedError`
- **Guards (client):** no-op, `isServer` check returns immediately
- **`shapeErrorHandler`:** 401 → hard redirect to `/login`, other errors → retry up to 2× then stop

## Routes

- `/_frame` (layout), `/` (index) → `authGuard`
- `/login`, `/signup`, `/forgot-password`, `/reset-password` → `guestGuard`
