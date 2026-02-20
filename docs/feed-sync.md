# Feed Sync

## Normal flow

Every minute the orchestrator finds feeds where `last_sync_at < now - 15min` and `sync_status != 'broken'`, and enqueues up to 50 (oldest first). Each job fetches the feed URL, inserts new articles (deduped by GUID per user), and updates `last_sync_at`.

ETag / Last-Modified headers are stored on the feed row and sent on the next request. A 304 response skips all processing and just bumps `last_sync_at`.

Every attempt — success, skipped, or failure — writes a row to `feed_sync_logs`. All log writes happen in the worker's BullMQ event handlers (`completed` / `failed`), not inside `syncSingleFeed`. This ensures exactly one log row per attempt with no duplicates.

`syncSingleFeed` returns a result object `{ status, httpStatus, articlesAdded }` on success, which BullMQ stores as the job return value and passes to the `completed` event. On failure, a custom error class (`FeedSyncError`) carries `httpStatus` alongside the message so the `failed` event has full context for the log.

## Retry system

All retries are handled by BullMQ. On failure the job is retried with exponential backoff (5 min base, 10 attempts total, ~3 day spread). There is no in-app retry loop.

Each failed attempt writes one `failed` log entry. The attempt number is derived from `job.attemptsMade + 1`.

## Feed health (`sync_status`)

| Status    | When                                                   |
| --------- | ------------------------------------------------------ |
| `ok`      | Last sync succeeded                                    |
| `failing` | At least one attempt failed, retries still pending     |
| `broken`  | All 10 attempts exhausted — excluded from orchestrator |

On the first failed attempt the feed is set to `failing`. After all retries are exhausted it becomes `broken` and `sync_error` is updated with the final error message. A successful sync resets to `ok` and clears `sync_error`.

## Broken feed recovery

`forceEnqueueFeedSync(feedId)` removes any existing queued job and enqueues a fresh one with no delay and attempt count reset to 0. Use this for user-triggered "retry" or "reset" actions. The client should optimistically set `sync_status = 'ok'` and `sync_error = null` before calling it.

## Deduplication

Job IDs are `feed-sync:{feedId}`. BullMQ drops duplicate enqueues for jobs already waiting, delayed, or active — so the orchestrator never stacks jobs for a feed that is mid-retry. `forceEnqueueFeedSync` explicitly removes the existing job first to bypass this.
