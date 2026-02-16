/**
 * Returns the full URL for an Electric shape endpoint.
 * In the browser, constructs absolute URL from window.location.
 * On the server, returns the path as-is.
 */
export function getShapeUrl(model: string): string {
  const path = `/api/shapes/${model}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/**
 * Normalizes a Postgres timestamp string to ISO 8601 format.
 * Postgres `timestamp` (without timezone) returns "2026-02-16 21:03:57.314654"
 * This converts it to "2026-02-16T21:03:57.314654Z" (replaces space with T, appends Z).
 *
 * All timestamps in the DB are stored as UTC (using `timestamp` type with server in UTC),
 * so appending Z is correct.
 */
function normalizeTimestamp(value: string): string {
  // Already has a T separator — likely already ISO format
  if (value.includes('T')) return value;
  // Replace space with T and append Z for UTC
  return `${value.replace(' ', 'T')}Z`;
}

/**
 * Electric SQL parser that normalizes Postgres timestamp values to ISO 8601.
 * The `parser` option is keyed by Postgres column type.
 * Applied before schema validation, ensuring all timestamps are consistent.
 */
export const timestampParser: Record<string, (value: string) => string> = {
  timestamp: normalizeTimestamp,
  timestamptz: normalizeTimestamp,
};
