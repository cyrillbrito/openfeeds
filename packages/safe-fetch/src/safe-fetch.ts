import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPrivateIp } from './ip-check';

/**
 * SSRF-safe fetch.
 *
 * Wraps `fetch` to defend against Server-Side Request Forgery on every
 * outbound request whose URL originates (directly or transitively) from
 * user input.
 *
 * Protections:
 * - Only `http:` and `https:` are allowed.
 * - The hostname is resolved and rejected if any of its addresses fall in
 *   loopback, link-local (incl. cloud metadata `169.254.169.254`), private
 *   (RFC 1918), CGNAT, reserved/multicast, or IPv6 ULA/link-local ranges.
 *   IP categorization is delegated to `ipaddr.js`.
 * - Redirects are followed manually so each hop is re-validated; a redirect
 *   to an internal address is therefore blocked even if the initial host
 *   resolved publicly (defeats simple redirect-based SSRF).
 * - The number of redirects is bounded.
 * - A timeout is enforced via `AbortController`.
 *
 * NOTE: A TOCTOU window exists between DNS lookup and the actual TCP
 * connect. For full hardening, layer an undici `Agent` with a `connect`
 * hook (or an outbound egress proxy) that re-checks the resolved IP at
 * socket-open time. The lookup-based check still blocks every realistic
 * exploit (cloud metadata, internal scans with literal IPs, `localhost`).
 */

export class SsrfBlockedError extends Error {
  constructor(
    public readonly host: string,
    public readonly ip?: string,
  ) {
    super(`Blocked SSRF target: ${host}${ip ? ` (resolved to ${ip})` : ''}`);
    this.name = 'SsrfBlockedError';
  }
}

export class FetchTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Fetch timed out after ${timeoutMs / 1000}s`);
    this.name = 'FetchTimeoutError';
  }
}

const DEFAULT_MAX_REDIRECTS = 5;

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal');
}

async function assertPublicHost(host: string): Promise<void> {
  if (isBlockedHostname(host)) {
    throw new SsrfBlockedError(host);
  }

  // URL parsing wraps IPv6 hostnames in brackets — strip them before isIP.
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  // Literal IP: validate directly (no DNS).
  if (isIP(bare)) {
    if (isPrivateIp(bare)) {
      throw new SsrfBlockedError(host, bare);
    }
    return;
  }

  // Hostname: resolve all addresses and reject if ANY is private.
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    // DNS failure — let the actual fetch produce a more specific error.
    return;
  }

  for (const { address } of records) {
    if (isPrivateIp(address)) {
      throw new SsrfBlockedError(host, address);
    }
  }
}

export interface SafeFetchOptions extends Omit<RequestInit, 'redirect' | 'signal'> {
  /** Hard deadline for the entire request (including all redirect hops). */
  timeoutMs: number;
  /** Maximum number of redirects to follow. Defaults to 5. */
  maxRedirects?: number;
  /**
   * Escape hatch for trusted server-to-server calls (e.g. internal services
   * on a private network you actually want to reach). Default: false.
   *
   * Only applies to the initial URL. Redirect targets are *always*
   * validated — a trusted internal endpoint must never be allowed to
   * redirect the client to an arbitrary internal address.
   */
  allowPrivateHosts?: boolean;
}

/**
 * SSRF-safe replacement for `fetch`.
 *
 * Throws:
 * - {@link SsrfBlockedError} if the URL (or any redirect hop) targets a
 *   blocked host.
 * - {@link FetchTimeoutError} if the request exceeds `timeoutMs`.
 * - Any error the underlying `fetch` would throw (network failure, etc.).
 */
export async function safeFetch(
  inputUrl: string,
  { timeoutMs, maxRedirects = DEFAULT_MAX_REDIRECTS, allowPrivateHosts, ...init }: SafeFetchOptions,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url = inputUrl;
    let method = init.method ?? 'GET';
    let body = init.body;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new SsrfBlockedError(url);
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new SsrfBlockedError(parsed.protocol);
      }

      // The `allowPrivateHosts` escape hatch is only honoured for the initial
      // hop. Redirects are always re-validated.
      const skipValidation = allowPrivateHosts && hop === 0;
      if (!skipValidation) {
        await assertPublicHost(parsed.hostname);
      }

      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          method,
          body,
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new FetchTimeoutError(timeoutMs);
        }
        throw error;
      }

      // Follow 3xx manually so each hop re-validates the host.
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return response;

        // Resolve relative redirects against the current URL.
        const next = new URL(location, url).toString();
        url = next;

        // Per RFC 7231: 301/302/303 typically downgrade to GET and drop body.
        // 307/308 preserve method and body.
        if (response.status === 301 || response.status === 302 || response.status === 303) {
          method = 'GET';
          body = undefined;
        }
        continue;
      }

      return response;
    }

    throw new Error(`Too many redirects (>${maxRedirects})`);
  } finally {
    clearTimeout(timer);
  }
}
