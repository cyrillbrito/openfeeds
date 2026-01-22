import { dbProvider } from '@repo/domain';
import * as ttsDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

/**
 * Check if audio exists for an article and get metadata
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
 * Generate audio for an article on-demand
 */
export const $$generateArticleAudio = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ articleId: z.string(), voice: z.string().optional() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const { articleId, voice } = data;
    const db = dbProvider.userDb(userId);

    const metadata = await ttsDomain.generateArticleAudio(articleId, userId, db, { voice });

    return {
      audioUrl: `/api/articles/${articleId}/audio`,
      duration: metadata.duration,
      wordTimings: metadata.wordTimings,
    };
  });
