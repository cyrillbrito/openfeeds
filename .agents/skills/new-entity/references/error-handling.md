# Error Handling

## Domain Errors

Transport-agnostic. The domain layer throws errors without knowing the caller.

| Class                   | Typical Use                            |
| ----------------------- | -------------------------------------- |
| `NotFoundError`         | Entity lookup misses                   |
| `BadRequestError`       | Invalid input beyond schema validation |
| `ConflictError`         | Duplicate creation                     |
| `UnexpectedError`       | DB failures, unrecoverable states      |
| `UnauthorizedError`     | Permission denied                      |
| `LimitExceededError`    | Free-tier usage limits                 |

**Rules:**
- Throw directly from domain functions — no wrapping, no catching at domain level.
- Messages must be user-safe (they reach the client as-is).

## Error Boundary

Sits between domain and each transport. Classifies errors:

- **Domain errors** — pass through unchanged (already user-safe).
- **Infrastructure errors** (Drizzle, Postgres) — logged with full cause chain, reported to PostHog, replaced with `UnexpectedError("An unexpected error occurred")`.

## Adding New Domain Errors

1. Define in `packages/domain/src/errors.ts` with user-safe default message.
2. Export from `packages/domain/src/index.ts`.
3. Add to `DOMAIN_ERRORS` array in `packages/domain/src/error-boundary.ts` — so the boundary passes it through instead of sanitizing.
4. Throw from domain functions.
5. If the new error needs a specific HTTP status, update `app.onError()` in `apps/server/src/index.ts`.

## Client-Side Error Flow

Hono routes return errors as JSON: `{ message: string }` with the HTTP status. The `unwrap()` helper in `apps/web/src/lib/api-client.ts` checks `res.ok` and throws `new Error(message)` on non-2xx. Client code uses `err.message` only — no `instanceof`, no `code` property.

```typescript
try {
  await unwrap(api.api.feeds.create.$post({ json: feeds }));
} catch (err) {
  setError(err instanceof Error ? err.message : 'Something went wrong');
}
```

## Assertions

Use `assert()` for programmer invariants (values that should always exist but TypeScript can't prove). Do NOT use for user input validation.

```typescript
const newFeed = dbResult[0];
assert(newFeed, 'Created feed must exist');
// TypeScript now knows newFeed is defined
```
