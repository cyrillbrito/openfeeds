import { getUserDb } from '@repo/db';
import * as ttsDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

/**
 * Check if audio exists for an article and get metadata.
 *
 * Returns metadata and a URL to the streaming endpoint.
 * The audio URL points to a dedicated streaming endpoint because:
 * - Audio files are too large to transmit via server functions (base64 would add 33% overhead)
 * - Streaming requires proper HTTP features (byte-range requests, caching headers)
 * - This pattern separates metadata operations (server functions) from file streaming (HTTP endpoints)
 */
export const $$getArticleAudio = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ articleId: z.string() }))
  .handler(({ context, data }) => {
    const userId = context.user.id;
    const { articleId } = data;

    if (!ttsDomain.articleAudioExists(userId, articleId)) {
      return { exists: false as const };
    }

    return ttsDomain.getArticleAudioMetadata(userId, articleId).then((metadata) => {
      if (!metadata) {
        return { exists: false as const };
      }

      return {
        exists: true as const,
        audioUrl: `/api/articles/${articleId}/audio`,
        duration: metadata.duration,
        wordTimings: metadata.wordTimings,
      };
    });
  });

/**
 * Generate audio for an article on-demand.
 *
 * Generates the audio file and saves it to disk, then returns metadata
 * and a URL to the streaming endpoint. The actual audio is served via
 * the streaming endpoint to avoid memory issues with large files.
 */
export const $$generateArticleAudio = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ articleId: z.string(), voice: z.string().optional() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const { articleId, voice } = data;
    const db = getUserDb(userId);

    const metadata = await ttsDomain.generateArticleAudio(articleId, userId, db, { voice });

    return {
      audioUrl: `/api/articles/${articleId}/audio`,
      duration: metadata.duration,
      wordTimings: metadata.wordTimings,
    };
  });
