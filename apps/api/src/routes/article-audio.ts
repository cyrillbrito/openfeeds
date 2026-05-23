import { zValidator } from '@hono/zod-validator';
import {
  articleAudioExists,
  generateArticleAudio,
  getArticleAudioBuffer,
  getArticleAudioMetadata,
  isTtsConfigured,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuthMiddleware, type Env } from '~/middleware/auth';

/**
 * `/stream/:articleId` is a binary HTTP stream (not RPC) — large mp3 bodies,
 * byte-range capable, cache-headered. Kept in this file so audio routes live
 * together; the URL is referenced as `audioUrl` in `/metadata` and `/generate`
 * responses below.
 */

// Audio stream URL is built here in one place so consumers reference it
// through `audioUrl` (returned in `/metadata` and `/generate` responses).
const audioUrl = (articleId: string) => `/api/article-audio/stream/${articleId}`;

export const articleAudioRoutes = new Hono<Env>()
  // `isTtsAvailable` is intentionally public — used by the UI to show or hide
  // TTS controls before the user authenticates / on first paint.
  .get('/available', (c) => c.json({ available: isTtsConfigured() }))
  .use('*', requireAuthMiddleware)
  .get('/metadata', zValidator('query', z.object({ articleId: z.uuidv7() })), async (c) => {
    const user = c.var.user;
    const { articleId } = c.req.valid('query');

    if (!articleAudioExists(user.id, articleId)) {
      return c.json({ exists: false as const });
    }
    const metadata = await getArticleAudioMetadata(user.id, articleId);
    if (!metadata) {
      return c.json({ exists: false as const });
    }
    return c.json({
      exists: true as const,
      audioUrl: audioUrl(articleId),
      duration: metadata.duration,
      wordTimings: metadata.wordTimings,
    });
  })
  .post(
    '/generate',
    zValidator('json', z.object({ articleId: z.uuidv7(), voice: z.string().optional() })),
    async (c) => {
      const user = c.var.user;
      const { articleId, voice } = c.req.valid('json');
      const metadata = await generateArticleAudio(articleId, user.id, user.plan, {
        voice,
      });
      return c.json({
        audioUrl: audioUrl(articleId),
        duration: metadata.duration,
        wordTimings: metadata.wordTimings,
      });
    },
  )
  /**
   * Streaming audio endpoint. Returns the raw mp3 with cache + range headers.
   * Not RPC-shaped — the client uses the `audioUrl` from `/metadata` as an
   * `<audio src>`, so this never goes through `hc<App>`.
   */
  .get(
    '/stream/:articleId',
    zValidator('param', z.object({ articleId: z.uuidv7() })),
    async (c) => {
      const user = c.var.user;
      const { articleId } = c.req.valid('param');

      const audioBuffer = await getArticleAudioBuffer(user.id, articleId);
      if (!audioBuffer) {
        return c.json({ message: 'Audio not found' }, 404);
      }

      // Convert Buffer to Uint8Array for Response compatibility.
      const uint8Array = new Uint8Array(audioBuffer);

      return new Response(uint8Array, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    },
  );
