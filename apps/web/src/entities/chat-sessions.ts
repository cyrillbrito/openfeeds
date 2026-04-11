import { snakeCamelMapper } from '@electric-sql/client';
import { ChatSessionSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection } from '@tanstack/solid-db';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$deleteChatSession, $$saveChatSession } from './chat-sessions.functions';

export const chatSessionsCollection = createCollection(
  electricCollectionOptions({
    id: 'chat-sessions',
    schema: ChatSessionSchema,
    getKey: (item) => item.id,

    // autoIndex: 'eager' restores the pre-0.6 default, which was changed to 'off'.
    // It auto-creates B-tree indexes for fields used in orderBy/where at query time.
    autoIndex: 'eager' as const,
    defaultIndexType: BasicIndex,

    shapeOptions: {
      url: getShapeUrl('chat-sessions'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('chat-sessions.shape'),
    },
    onInsert: collectionErrorHandler('chat-sessions.onInsert', async ({ transaction }) => {
      const results = await Promise.all(
        transaction.mutations.map((mutation) =>
          $$saveChatSession({
            data: {
              id: mutation.key as string,
              title: mutation.modified.title,
              messages: mutation.modified.messages,
            },
          }),
        ),
      );
      return results[results.length - 1];
    }),
    onUpdate: collectionErrorHandler('chat-sessions.onUpdate', async ({ transaction }) => {
      const results = await Promise.all(
        transaction.mutations.map((mutation) =>
          $$saveChatSession({
            data: {
              id: mutation.key as string,
              title: mutation.modified.title,
              messages: mutation.modified.messages,
            },
          }),
        ),
      );
      return results[results.length - 1];
    }),
    onDelete: collectionErrorHandler('chat-sessions.onDelete', async ({ transaction }) => {
      const results = await Promise.all(
        transaction.mutations.map((mutation) =>
          $$deleteChatSession({ data: mutation.key as string }),
        ),
      );
      return results[results.length - 1];
    }),
  }),
);
