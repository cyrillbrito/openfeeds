import { getAllArticleTags } from '@repo/domain';
import { ArticleTagSchema } from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

export const articleTagsApp = new Elysia({ prefix: '/article-tags' })
  .use(errorHandlerPlugin)
  .use(authPlugin)
  .get(
    '/',
    async ({ db }) => {
      const articleTags = await getAllArticleTags(db);
      return articleTags;
    },
    {
      response: ArticleTagSchema.array(),
      detail: {
        tags: ['Article Tags'],
        summary: 'List all article tags',
      },
    },
  );
