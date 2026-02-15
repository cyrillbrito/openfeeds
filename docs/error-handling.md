# Error Handling Architecture

## Principle

Domain errors are **transport-agnostic**. The domain layer throws errors without knowing the caller. Each transport layer maps them to its own format (HTTP status codes, job failure states, etc.).

## Domain Errors (`packages/domain/src/errors.ts`)

Custom error classes extending `Error`. Server-side code uses `instanceof` to discriminate.

| Class                   | Default Message                    | Typical Use                            |
| ----------------------- | ---------------------------------- | -------------------------------------- |
| `NotFoundError`         | Resource not found                 | Entity lookup misses                   |
| `BadRequestError`       | Bad Request                        | Invalid input beyond schema validation |
| `ConflictError`         | Resource already exists            | Duplicate creation                     |
| `UnexpectedError`       | An unexpected error occurred       | DB failures, unrecoverable states      |
| `UnauthorizedError`     | Unauthorized                       | Permission denied                      |
| `TtsNotConfiguredError` | Text-to-speech is not available... | Feature not enabled                    |

**Rules:**

- Throw directly from domain functions — no wrapping, no catching at the domain level
- Messages must be user-safe (they reach the client as-is)

## Assertions (`assert()`)

TypeScript assertion helper for **programmer invariants** — conditions that must always hold. Failure in production means a bug, not a user error.

```typescript
export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) throw new AssertionError(msg);
}
```

The `asserts condition` return type narrows the type after the call — eliminates `null | undefined` without a manual `if` check.

```typescript
const newFeed = dbResult[0];
assert(newFeed, 'Created feed must exist');
// TypeScript now knows newFeed is defined
```

Use for values that should always exist but TypeScript can't prove (e.g., `array[0]` after INSERT with `.returning()`). Do **not** use for user input validation — use domain errors instead. `AssertionError` is never caught or mapped to HTTP status codes; it always propagates as a 500.

## Error Flow

```
Domain Layer                    Transport Layer                 Client/Consumer
─────────────                   ───────────────                 ───────────────
throw NotFoundError()    →    Server function (seroval)     →    catch (err)
                              only message survives              display err.message

throw ConflictError()    →    API route catch block         →    HTTP 409 response
                              instanceof works (same process)

throw NotFoundError()    →    Worker try-catch              →    Log + retry/skip
                              instanceof works (same process)
```

## Web App: Server Functions

TanStack Start uses seroval's `ShallowErrorPlugin` to serialize errors. Only `message` survives — `instanceof`, `name`, `stack`, and custom properties are stripped. The client receives a plain `Error(message)`. Server stack traces are never sent.

```typescript
try {
  await $$createFeed({ data });
} catch (err) {
  setError(err instanceof Error ? err.message : 'Something went wrong');
}
```

No error type discrimination is needed or possible on the client.

## Web App: Error Boundaries

Error boundaries catch errors during **rendering** — as opposed to try-catch in imperative handlers.

**Router-level defaults** (`apps/web/src/router.tsx`): `defaultErrorComponent: DefaultCatchBoundary`, `defaultNotFoundComponent: NotFound`. No route overrides these.

| Component              | Type                    | Scope                            | File                                      |
| ---------------------- | ----------------------- | -------------------------------- | ----------------------------------------- |
| `DefaultCatchBoundary` | TanStack Router         | Full-page, unhandled route error | `src/components/DefaultCatchBoundary.tsx` |
| `NotFound`             | TanStack Router         | Full-page, unmatched routes      | `src/components/NotFound.tsx`             |
| `CommonErrorBoundary`  | SolidJS `ErrorBoundary` | Section-level, reusable          | `src/components/CommonErrorBoundary.tsx`  |
| `LazyModal`            | SolidJS `ErrorBoundary` | Per-modal content                | `src/components/LazyModal.tsx`            |
| `ShortsViewer`         | SolidJS `ErrorBoundary` | Shorts player area               | `src/components/ShortsViewer.tsx`         |

```
Component tree error       →  Nearest SolidJS ErrorBoundary  →  Inline error + retry
Route rendering error      →  DefaultCatchBoundary           →  Full-page error + "Try Again"
Unmatched route            →  NotFound                       →  Full-page 404
Server function throw      →  try-catch in handler           →  setError(err.message)
Uncaught server fn throw   →  DefaultCatchBoundary           →  Full-page error
```

## Web App: API Routes

API routes run server-side where `instanceof` works. Map domain errors to HTTP status codes:

```typescript
try {
  const result = await createFeed(userId, data);
  return Response.json(result, { status: 201 });
} catch (error) {
  if (error instanceof ConflictError)
    return Response.json({ message: error.message }, { status: 409 });
  if (error instanceof BadRequestError)
    return Response.json({ message: error.message }, { status: 400 });
  return Response.json({ message: 'Internal server error' }, { status: 500 });
}
```

## Worker

Workers run server-side where `instanceof` works. Two strategies:

- **Let it throw** — job fails in BullMQ, triggers retry (transient/system errors)
- **Catch + log + continue** — per-item errors logged, job succeeds (expected per-item failures)

```typescript
// Per-item failure — log and continue
for (const user of users) {
  try {
    await syncOldestFeeds(user.id);
  } catch (err) {
    logger.error(err instanceof Error ? err : new Error(String(err)), { userId: user.id });
    continue;
  }
}
```

## Production Error Monitoring

**PostHog** captures exceptions across all layers:

- **Server-side:** `logger.error(error, metadata)` → PostHog via domain logger
- **Client-side:** `posthog.captureException(err)` for unexpected UI errors; known errors shown to user instead

## Adding New Domain Errors

1. Define in `packages/domain/src/errors.ts` with user-safe default message
2. Export from `packages/domain/src/index.ts`
3. Throw from domain functions — don't catch/wrap at domain level
4. Update API route error mapping if needed for specific HTTP status
