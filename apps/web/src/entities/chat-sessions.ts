import { snakeCamelMapper } from '@electric-sql/client';
import { ChatSessionSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$deleteChatSession, $$saveChatSession } from './chat-sessions.functions';

export const chatSessionsCollection = createCollection(
  electricCollectionOptions({
    id: 'chat-sessions',
    schema: ChatSessionSchema,
    getKey: (item) => item.id,
    shapeOptions: {
      url: getShapeUrl('chat-sessions'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('chat-sessions.shape'),
    },
    onInsert: collectionErrorHandler('chat-sessions.onInsert', async ({ transaction }) => {
      const mutation = transaction.mutations[0];
      const session = mutation.modified;
      return await $$saveChatSession({
        data: {
          id: mutation.key as string,
          title: session.title,
          messages: session.messages,
        },
      });
    }),
    onUpdate: collectionErrorHandler('chat-sessions.onUpdate', async ({ transaction }) => {
      const mutation = transaction.mutations[0];
      const session = mutation.modified;
      return await $$saveChatSession({
        data: { id: mutation.key as string, title: session.title, messages: session.messages },
      });
    }),
    onDelete: collectionErrorHandler('chat-sessions.onDelete', async ({ transaction }) => {
      const id = transaction.mutations[0].key as string;
      return await $$deleteChatSession({ data: { id } });
    }),
  }),
);

/** Live query for session summaries, ordered by most recent */
export function useChatSessions() {
  return useLiveQuery((q) =>
    q.from({ session: chatSessionsCollection }).orderBy(({ session }) => session.updatedAt, 'desc'),
  );
}
