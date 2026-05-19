import ipaddr from 'ipaddr.js';

/**
 * IPv4 categories that should never be reachable from a server-side fetch
 * driven by user input.
 *
 * We treat as "private":
 * - `unspecified`     0.0.0.0/8       (incl. 0.0.0.0)
 * - `broadcast`       255.255.255.255
 * - `multicast`       224.0.0.0/4
 * - `linkLocal`       169.254.0.0/16  (cloud metadata lives here)
 * - `loopback`        127.0.0.0/8
 * - `carrierGradeNat` 100.64.0.0/10
 * - `private`         10/8, 172.16/12, 192.168/16
 * - `reserved`        240.0.0.0/4 etc.
 *
 * `ipaddr.js` classifies `198.18.0.0/15` (RFC 2544 benchmarking) as plain
 * `unicast`, so we add an explicit check for it.
 */
const BLOCKED_IPV4_RANGES = new Set<string>([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'carrierGradeNat',
  'private',
  'reserved',
]);

/**
 * IPv6 categories that should never be reachable.
 *
 * We treat as "private":
 * - `unspecified` ::
 * - `loopback`    ::1
 * - `linkLocal`   fe80::/10
 * - `uniqueLocal` fc00::/7
 * - `multicast`   ff00::/8
 * - `reserved`
 *
 * `ipv4Mapped` (::ffff:0:0/96) is handled separately by extracting the
 * embedded IPv4 and recursing.
 */
const BLOCKED_IPV6_RANGES = new Set<string>([
  'unspecified',
  'loopback',
  'linkLocal',
  'uniqueLocal',
  'multicast',
  'reserved',
  // ipaddr.js v2 split these out of `reserved`/`unicast`.
  'deprecatedSiteLocal', // fec0::/10
  'discard', // 100::/64
  'benchmarking', // 2001:2::/48
]);

/**
 * Returns true if the literal IP address is private, loopback, link-local,
 * CGNAT, reserved, multicast, broadcast, ULA, or IPv4-mapped private.
 *
 * Returns true for unparseable input — callers must not pass non-IPs.
 */
export function isPrivateIp(ip: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return true;
  }

  if (parsed.kind() === 'ipv4') {
    const v4 = parsed as ipaddr.IPv4;
    if (BLOCKED_IPV4_RANGES.has(v4.range())) return true;
    // RFC 2544 benchmarking 198.18.0.0/15 — ipaddr.js calls this `unicast`.
    if (v4.match(ipaddr.parseCIDR('198.18.0.0/15') as [ipaddr.IPv4, number])) return true;
    return false;
  }

  const v6 = parsed as ipaddr.IPv6;
  if (v6.isIPv4MappedAddress()) {
    return isPrivateIp(v6.toIPv4Address().toString());
  }
  return BLOCKED_IPV6_RANGES.has(v6.range());
}
