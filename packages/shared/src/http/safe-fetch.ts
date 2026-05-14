import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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

/**
 * Returns true if the literal IP address is private, loopback, link-local,
 * CGNAT, reserved, multicast, broadcast, ULA, or IPv4-mapped private.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip === '0.0.0.0' || ip === '::' || ip === '::1') return true;

  const family = isIP(ip);

  if (family === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    return (
      a === 0 || // 0.0.0.0/8 "this network"
      a === 10 || // 10.0.0.0/8 RFC 1918
      a === 127 || // 127.0.0.0/8 loopback
      (a === 169 && b === 254) || // 169.254.0.0/16 link-local incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 RFC 1918
      (a === 192 && b === 168) || // 192.168.0.0/16 RFC 1918
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
      (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
      a >= 224 // multicast (224/4) + reserved (240/4) + 255.255.255.255
    );
  }

  if (family === 6) {
    const lower = ip.toLowerCase();

    // IPv4-mapped IPv6 — re-check embedded v4.
    // Two forms: dotted "::ffff:127.0.0.1" or compact "::ffff:7f00:1".
    if (lower.startsWith('::ffff:')) {
      const tail = lower.slice(7);
      if (isIP(tail) === 4) return isPrivateIp(tail);
      // Compact form: two hex words "hhhh:hhhh" → 4 bytes → dotted v4.
      const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
      if (m) {
        const hi = parseInt(m[1]!, 16);
        const lo = parseInt(m[2]!, 16);
        const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateIp(v4);
      }
    }

    // Unique local addresses fc00::/7 (fc.. and fd..)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local fe80::/10 (fe80..febf)
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true;
    }
    return false;
  }

  // Not a valid IP — caller should not pass non-IPs here.
  return true;
}

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
