import {
  articleAudioExists,
  generateArticleAudio,
  getArticleAudioBuffer,
  getArticleAudioMetadata,
} from '@repo/domain';
import {
  GenerateArticleAudioRequestSchema,
  GenerateArticleAudioResponseSchema,
  GetArticleAudioResponseSchema,
} from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

export const articleAudioApp = new Elysia({ prefix: '/articles' })
  .use(errorHandlerPlugin)
  .use(authPlugin)
  /**
   * Get audio metadata for an article
   * Returns audio info if exists, or { exists: false } if not generated yet
   */
  .get(
    '/:id/audio',
    async ({ params, user }) => {
      const { id: articleId } = params;

      if (!articleAudioExists(user.id, articleId)) {
        return { exists: false as const };
      }

      const metadata = await getArticleAudioMetadata(user.id, articleId);
      if (!metadata) {
        return { exists: false as const };
      }

      return {
        exists: true as const,
        audioUrl: `/api/articles/${articleId}/audio/file`,
        duration: metadata.duration,
        wordTimings: metadata.wordTimings,
      };
    },
    {
      params: z.object({ id: z.string() }),
      response: GetArticleAudioResponseSchema,
      detail: {
        tags: ['Article Audio'],
        summary: 'Get audio metadata for an article',
      },
    },
  )
  /**
   * Generate audio for an article (on-demand)
   */
  .post(
    '/:id/audio',
    async ({ params, body, user, db }) => {
      const { id: articleId } = params;

      try {
        const metadata = await generateArticleAudio(articleId, user.id, db, {
          voice: body?.voice,
        });

        return {
          success: true,
          audioUrl: `/api/articles/${articleId}/audio/file`,
          duration: metadata.duration,
          wordTimings: metadata.wordTimings,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    {
      params: z.object({ id: z.string() }),
      body: GenerateArticleAudioRequestSchema.optional(),
      response: GenerateArticleAudioResponseSchema,
      detail: {
        tags: ['Article Audio'],
        summary: 'Generate audio for an article',
      },
    },
  )
  /**
   * Serve the audio file
   */
  .get(
    '/:id/audio/file',
    async ({ params, user, set }) => {
      const { id: articleId } = params;

      const audioBuffer = await getArticleAudioBuffer(user.id, articleId);
      if (!audioBuffer) {
        set.status = 404;
        return { error: 'Audio not found' };
      }

      set.headers['Content-Type'] = 'audio/mpeg';
      set.headers['Content-Length'] = audioBuffer.length.toString();
      set.headers['Accept-Ranges'] = 'bytes';
      set.headers['Cache-Control'] = 'public, max-age=31536000, immutable';

      return audioBuffer;
    },
    {
      params: z.object({ id: z.string() }),
      detail: {
        tags: ['Article Audio'],
        summary: 'Serve the audio file for an article',
      },
    },
  );
