import {
  getArticles,
  getArticleWithContent,
  markManyArticlesArchived,
  updateArticle,
} from '@repo/domain';
import {
  ArticleQuerySchema,
  ArticleSchema,
  ArticleWithContentSchema,
  createPaginatedResponseSchema,
  MarkManyArchivedRequestSchema,
  MarkManyArchivedResponseSchema,
  UpdateArticleSchema,
} from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

const PaginatedArticlesSchema = createPaginatedResponseSchema(ArticleSchema);

export const articlesApp = new Elysia({ prefix: '/articles' })
  .use(errorHandlerPlugin)
  .use(authPlugin)
  .get(
    '/',
    async ({ query, user }) => {
      const result = await getArticles(query, user.id);
      return result;
    },
    {
      query: ArticleQuerySchema,
      response: PaginatedArticlesSchema,
      detail: {
        tags: ['Articles'],
        summary: 'List filtered articles',
      },
    },
  )
  .put(
    '/:id',
    async ({ params, body, user }) => {
      const updatedArticle = await updateArticle(params.id, body, user.id);
      return updatedArticle;
    },
    {
      params: z.object({ id: z.string() }),
      body: UpdateArticleSchema,
      response: ArticleSchema,
      detail: {
        tags: ['Articles'],
        summary: 'Update existing article',
      },
    },
  )
  .post(
    '/mark-many-archived',
    async ({ body, user }) => {
      const result = await markManyArticlesArchived(body, user.id);
      return result;
    },
    {
      body: MarkManyArchivedRequestSchema,
      response: MarkManyArchivedResponseSchema,
      detail: {
        tags: ['Articles'],
        summary: 'Mark multiple articles as archived',
      },
    },
  )
  .get(
    '/:id',
    async ({ params, user }) => {
      const article = await getArticleWithContent(params.id, user.id);
      return article;
    },
    {
      params: z.object({ id: z.string() }),
      response: ArticleWithContentSchema,
      detail: {
        tags: ['Articles'],
        summary: 'Get article by ID',
      },
    },
  );
