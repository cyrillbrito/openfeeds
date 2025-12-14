import { getUserSettings, performArchiveArticles, updateUserSettings } from '@repo/domain';
import { AppSettingsSchema, ArchiveResultSchema, UpdateSettingsSchema } from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

export const settingsApp = new Elysia({ prefix: '/settings' })
  .use(errorHandlerPlugin)
  .use(authPlugin)
  .get(
    '/',
    async ({ db }) => {
      const userSettings = await getUserSettings(db);
      return userSettings;
    },
    {
      response: AppSettingsSchema,
      detail: {
        tags: ['Settings'],
        summary: 'Get user settings',
      },
    },
  )
  .put(
    '/',
    async ({ body, db }) => {
      const newSettings = await updateUserSettings(db, body);
      return newSettings;
    },
    {
      body: UpdateSettingsSchema,
      response: AppSettingsSchema,
      detail: {
        tags: ['Settings'],
        summary: 'Update user settings',
      },
    },
  )
  .post(
    '/auto-archive',
    async ({ db }) => {
      const result = await performArchiveArticles(db);
      return result;
    },
    {
      response: ArchiveResultSchema,
      detail: {
        tags: ['Settings'],
        summary: 'Manually trigger archive for old articles',
        description:
          'Retroactively apply auto-archive logic to all existing articles based on current autoArchiveDays setting.',
      },
    },
  );
