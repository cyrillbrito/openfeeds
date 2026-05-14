import { describe, expect, test } from 'bun:test';
import { isPrivateIp, safeFetch, SsrfBlockedError } from './safe-fetch';

describe('isPrivateIp', () => {
  test.each([
    ['127.0.0.1'],
    ['127.42.1.1'],
    ['10.0.0.1'],
    ['10.255.255.255'],
    ['172.16.0.1'],
    ['172.31.255.255'],
    ['192.168.0.1'],
    ['169.254.169.254'], // AWS/GCP/Azure metadata
    ['169.254.0.1'],
    ['100.64.0.1'], // CGNAT
    ['100.127.255.255'],
    ['0.0.0.0'],
    ['224.0.0.1'], // multicast
    ['255.255.255.255'], // broadcast
    ['198.18.0.1'], // benchmarking
    ['::1'], // IPv6 loopback
    ['::'],
    ['fc00::1'], // ULA
    ['fd00::1'],
    ['fe80::1'], // link-local
    ['febf::1'],
    ['::ffff:127.0.0.1'], // IPv4-mapped loopback
    ['::ffff:169.254.169.254'], // IPv4-mapped metadata
  ])('blocks %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  test.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['142.250.80.46'], // public Google
    ['172.32.0.1'], // just outside RFC 1918
    ['172.15.255.255'],
    ['100.63.255.255'], // just outside CGNAT
    ['100.128.0.1'],
    ['169.253.255.255'], // just outside link-local
    ['169.255.0.1'],
    ['198.20.0.1'], // just outside benchmarking
    ['223.255.255.255'], // just before multicast
    ['2001:4860:4860::8888'], // public IPv6
    ['2606:4700:4700::1111'],
  ])('allows %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe('safeFetch SSRF rejection', () => {
  test('rejects literal loopback IPv4', async () => {
    expect(safeFetch('http://127.0.0.1/', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects AWS metadata IP', async () => {
    expect(
      safeFetch('http://169.254.169.254/latest/meta-data/', { timeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  test('rejects literal IPv6 loopback', async () => {
    expect(safeFetch('http://[::1]/', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects IPv4-mapped IPv6 loopback', async () => {
    expect(safeFetch('http://[::ffff:127.0.0.1]/', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects "localhost"', async () => {
    expect(safeFetch('http://localhost/', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects "*.localhost"', async () => {
    expect(safeFetch('http://foo.localhost/', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects "*.internal"', async () => {
    expect(safeFetch('http://service.internal/', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects file: scheme', async () => {
    expect(safeFetch('file:///etc/passwd', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects gopher: scheme', async () => {
    expect(safeFetch('gopher://example.com:6379/_GET', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  test('rejects malformed URL', async () => {
    expect(safeFetch('not-a-url', { timeoutMs: 1000 })).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  test('allowPrivateHosts opts out (does not throw SsrfBlockedError)', async () => {
    // Will fail with a network error (nothing listening), but the SSRF check is bypassed.
    try {
      await safeFetch('http://127.0.0.1:1/', { timeoutMs: 200, allowPrivateHosts: true });
    } catch (error) {
      expect(error).not.toBeInstanceOf(SsrfBlockedError);
    }
  });
});

describe('safeFetch redirect handling', () => {
  test('redirect to internal host is blocked even if initial host is allowed', async () => {
    using server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'http://169.254.169.254/latest/meta-data/' },
        }),
    });

    expect(
      safeFetch(`http://127.0.0.1:${server.port}/`, { timeoutMs: 2000, allowPrivateHosts: true }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  test('initial allowPrivateHosts works on first hop only', async () => {
    using server = Bun.serve({
      port: 0,
      fetch: () => new Response('ok', { status: 200 }),
    });

    const res = await safeFetch(`http://127.0.0.1:${server.port}/`, {
      timeoutMs: 2000,
      allowPrivateHosts: true,
    });
    expect(res.status).toBe(200);
  });

  test('rejects non-http(s) Location targets', async () => {
    using server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'file:///etc/passwd' },
        }),
    });

    expect(
      safeFetch(`http://127.0.0.1:${server.port}/`, { timeoutMs: 2000, allowPrivateHosts: true }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});
