import { describe, expect, test } from 'bun:test';
import { safeFetch, SsrfBlockedError } from './safe-fetch';

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
