import { z } from 'zod';

/**
 * URL schema accepted by {@link safeFetch}.
 *
 * Restricted to `http:` and `https:` — other schemes (`file:`, `gopher:`,
 * `javascript:`, `data:`, `feed:`, ...) are rejected at validation time so
 * they cannot reach the fetch layer in the first place.
 *
 * Isomorphic — safe to import from client and server bundles.
 */
export const urlSchema = z
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: 'Only http and https URLs are supported' });
