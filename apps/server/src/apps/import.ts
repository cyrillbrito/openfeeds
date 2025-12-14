import { importOpmlFeeds } from '@repo/domain';
import { ImportOpmlRequestSchema, ImportResultSchema } from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

export const importApp = new Elysia({ prefix: '/import' })
  .use(errorHandlerPlugin)
  .use(authPlugin)
  .post(
    '/opml',
    async ({ body, user, db }) => {
      const { opmlContent } = body;
      const userId = user.id;

      const finalResult = await importOpmlFeeds(opmlContent, userId, db);

      if (!finalResult) {
        throw new Error('Import failed to complete');
      }

      return finalResult;
    },
    {
      body: ImportOpmlRequestSchema,
      response: ImportResultSchema,
      detail: {
        tags: ['Import'],
        summary: 'Import OPML feeds',
      },
    },
  );
