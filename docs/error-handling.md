# Error Handling Architecture

## Principle

Domain errors are **transport-agnostic**. The domain layer doesn't know whether it's called from a web server function, API route, worker, CLI, or MCP tool. Each transport layer is responsible for interpreting domain errors into its own format (HTTP status codes, exit codes, job failure states, etc.).

## Domain Errors (`packages/domain/src/errors.ts`)

Custom error classes that extend `Error`. Server-side code uses `instanceof` to discriminate.

```typescript
export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message ?? 'Resource not found');
  }
}
```

**Available errors:**

| Class                   | Default Message                    | Typical Use                            |
| ----------------------- | ---------------------------------- | -------------------------------------- |
| `NotFoundError`         | Resource not found                 | Entity lookup misses                   |
| `BadRequestError`       | Bad Request                        | Invalid input beyond schema validation |
| `ConflictError`         | Resource already exists            | Duplicate creation                     |
| `UnexpectedError`       | An unexpected error occurred       | DB failures, unrecoverable states      |
| `UnauthorizedError`     | Unauthorized                       | Permission denied                      |
| `TtsNotConfiguredError` | Text-to-speech is not available... | Feature not enabled                    |

**Rules:**

- Domain functions throw these errors directly — no wrapping, no catching at the domain level
- Error messages must be user-safe (they reach the client as-is)
- `assert()` helper throws `AssertionError` for invariant violations (programmer errors, not user errors)

## Error Flow

```
Domain Layer                    Transport Layer                 Client/Consumer
─────────────                   ───────────────                 ───────────────
throw NotFoundError()    →    Server function (seroval)     →    catch (err)
                              only message survives              display err.message

throw ConflictError()    →    API route catch block         →    HTTP 409 response
                              instanceof works (same process)
                              maps to HTTP status

throw NotFoundError()    →    Worker try-catch              →    Log + retry/skip
                              instanceof works (same process)
                              decides retry vs skip
```

## Web App: Server Functions

### How TanStack Start serializes errors (verified by testing)

TanStack Start uses seroval's `ShallowErrorPlugin` to serialize errors thrown in server functions. This plugin:

1. **Only serializes `message`** — all other properties (`name`, `stack`, custom props) are stripped
2. Reconstructs a plain `new Error(message)` on the client
3. Returns it as a 500 JSON response

**What the client receives:**

- `instanceof Error` → `true` (base `Error`, not the subclass)
- `err.message` → preserved (the domain error message)
- `err.constructor.name` → `Error` (subclass identity lost)
- `err.stack` → client-side deserialization stack, **not** the server stack

**Security:** Server stack traces and file paths are **never sent** to the client. No sanitization middleware needed — `ShallowErrorPlugin` handles this by design.

### Client-side error handling

The client only needs the message. Since domain errors have user-safe messages, the pattern is simple:

```typescript
try {
  await $$createFeed({ data });
} catch (err) {
  setError(err instanceof Error ? err.message : 'Something went wrong');
}
```

No error type discrimination is needed or possible on the client. If the UI ever needs to branch based on error type, the server function should return a structured result instead of throwing.

### Global fallback

`DefaultCatchBoundary` is registered as `defaultErrorComponent` on the router. It catches any unhandled error during route rendering and displays the error message.

## Web App: API Routes

API routes run **server-side** where `instanceof` works. They map domain errors to HTTP status codes:

```typescript
// apps/web/src/routes/api/feeds.ts
import { BadRequestError, ConflictError } from '@repo/domain';

try {
  const result = await createFeed(userId, data);
  return Response.json(result, { status: 201 });
} catch (error) {
  if (error instanceof ConflictError) {
    return Response.json({ message: error.message }, { status: 409 });
  }
  if (error instanceof BadRequestError) {
    return Response.json({ message: error.message }, { status: 400 });
  }
  return Response.json({ message: 'Internal server error' }, { status: 500 });
}
```

## Worker

Workers run **server-side** where `instanceof` works. Two strategies:

- **Let it throw:** Job fails in BullMQ, triggers retry. Used when the error is transient or represents a system failure.
- **Catch + log + continue:** Per-item errors are logged but the job succeeds. Used when individual item failure is expected (e.g., a broken feed in a loop).

```typescript
// Per-item failure in a loop — log and continue
for (const user of users) {
  try {
    await syncOldestFeeds(user.id);
  } catch (err) {
    logger.error(err instanceof Error ? err : new Error(String(err)), {
      source: 'worker',
      jobName: job.queueName,
      userId: user.id,
    });
    continue;
  }
}
```

```typescript
// Entire job failure — let it propagate to BullMQ for retry
async (job) => {
  await updateFeedMetadata(job.data.userId, job.data.feedId);
  // If this throws, the job fails and BullMQ handles retry
};
```

## Production Error Monitoring

**PostHog** captures exceptions in production across all layers:

- **Server-side:** `logger.error(error, metadata)` sends to PostHog via the domain logger (`packages/domain/src/logger.ts`). All worker and domain errors flow through this.
- **Client-side:** `posthog.captureException(err)` for unexpected errors in UI handlers. Known errors (e.g., `BetterFetchError` for auth forms) are shown to the user instead.

Errors appear in PostHog's error tracking dashboard with metadata (operation, feedId, userId, etc.) for debugging.

## Adding New Domain Errors

1. Define the class in `packages/domain/src/errors.ts`
2. Use a user-safe default message (it reaches the client as-is)
3. Export from `packages/domain/src/index.ts`
4. Throw it from domain functions — don't catch/wrap at the domain level
5. Update API route error mapping if the error should map to a specific HTTP status
