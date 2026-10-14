import { snakeCamelMapper } from '@electric-sql/client';
import { ChatSessionSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection } from '@tanstack/react-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';

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
      parser: {
        ...timestampParser,
      },
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('chat-sessions.shape'),
    },
    // Persistence is handled server-side by the AI middleware (`@repo/domain/ai`,
    // wired into `apps/server/src/routes/chat.ts`). Electric syncs the saved session
    // back to the client automatically. Only deletes are client-initiated and
    // need a server call.
    onDelete: collectionErrorHandler('chat-sessions.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => String(mutation.key));
      return await unwrap(api.api['chat-sessions'].delete.$post({ json: ids }));
    }),
  }),
);
