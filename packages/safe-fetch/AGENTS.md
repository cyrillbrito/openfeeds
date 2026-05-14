# Safe Fetch Package

SSRF-safe replacement for `fetch`, plus a Zod schema that mirrors what the
fetch function will actually accept.

Use this whenever a server-side request is built from user input — feed
URLs, article URLs, OPML imports, AI tool arguments, etc.

## Two entry points

| Import                       | Runtime         | Contents                                        |
| ---------------------------- | --------------- | ----------------------------------------------- |
| `@repo/safe-fetch`           | server only     | `safeFetch`, error classes, `isPrivateIp`       |
| `@repo/safe-fetch/schema`    | isomorphic      | `urlSchema` (Zod, http/https only)              |

The fetch entry imports `node:dns` and `node:net`, so it must not be
imported from client code. The schema entry is pure Zod and safe to import
from any bundle.

## Usage

### Server-side fetching

```typescript
import { safeFetch, SsrfBlockedError, FetchTimeoutError } from '@repo/safe-fetch';

try {
  const res = await safeFetch(userSuppliedUrl, { timeoutMs: 10_000 });
  // ...
} catch (error) {
  if (error instanceof SsrfBlockedError) {
    // Blocked: loopback, RFC 1918, link-local, cloud metadata, *.internal, etc.
  } else if (error instanceof FetchTimeoutError) {
    // Exceeded timeoutMs across all hops.
  } else {
    // Network / DNS error.
  }
}
```

`allowPrivateHosts: true` is an escape hatch for trusted internal calls
(e.g. an Electric proxy on a private network). It applies only to the
**initial** hop; redirect targets are always re-validated, so an
allowed-internal endpoint cannot redirect us to an arbitrary internal
address.

### Validating URLs at the schema layer

```typescript
import { urlSchema } from '@repo/safe-fetch/schema';

const FeedSchema = z.object({
  feedUrl: urlSchema,
});
```

This rejects `file:`, `gopher:`, `javascript:`, `data:`, `feed:`, `ftp:`,
etc. before they reach the fetch layer. Use it on every Zod field that will
later be passed to `safeFetch`.

## What's protected

- `http:` / `https:` only.
- All resolved IPs are checked (a hostname with both public and private
  A-records is rejected).
- IP categorization via `ipaddr.js`: blocks loopback, unspecified,
  broadcast, multicast, link-local (incl. cloud metadata
  `169.254.169.254`), CGNAT, RFC 1918 private, RFC 2544 benchmarking,
  reserved, IPv6 ULA, IPv6 link-local, and IPv4-mapped IPv6 forms of all
  the above.
- Hostname blocklist: `localhost`, `*.localhost`, `*.internal`.
- Manual redirect handling: each hop is re-validated.
- Bounded redirects (default 5).
- Hard timeout via `AbortController`.

## TOCTOU caveat

There is a window between DNS lookup and TCP connect during which a
"DNS rebinding" attacker could swap a public IP for a private one. The
realistic exploit path is closed (cloud metadata uses a literal IP;
`localhost` is a literal hostname; internal scans need literal IPs).
For full hardening, layer an undici `Agent` with a `connect` hook (Node
only — Bun's `fetch` ignores `http.Agent`) or an outbound egress proxy
such as Stripe's `smokescreen`.

## Development

```bash
bun test
```
