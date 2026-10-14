import { createId } from '@repo/shared/utils';
import { ChatClient, type UIMessage } from '@tanstack/ai-client';
import { fetchServerSentEvents } from '@tanstack/ai-react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { chatSessionsCollection } from '~/entities/chat-sessions';
import { ChatContext } from './chat-context.shared';
import type { ChatContextValue } from './chat-context.shared';
import { storedToUi } from './chat-utils';

export { useChatContext } from './chat-context.shared';
export type { ChatContextValue } from './chat-context.shared';

function deriveTitle(msgs: UIMessage[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const textPart = firstUser.parts.find((p) => p.type === 'text' && 'content' in p);
  if (!textPart || !('content' in textPart)) return 'New chat';
  const text = (textPart as { content: string }).content.trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [viewSessionId, setViewSessionId] = useState(() => createId());
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [viewedMessages, setViewedMessages] = useState<UIMessage[]>([]);
  const [streamMessages, setStreamMessages] = useState<UIMessage[]>([]);
  const [hookIsLoading, setHookIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const [client] = useState(
    () =>
      new ChatClient({
        connection: fetchServerSentEvents('/api/chat'),
        onMessagesChange: setStreamMessages,
        onLoadingChange: setHookIsLoading,
        onErrorChange: setError,
      }),
  );

  useEffect(() => () => client.stop(), [client]);

  // Reactively track the viewed session in the collection.
  const { data: viewedSessionQueryData } = useLiveQuery(
    (q) =>
      q
        .from({ s: chatSessionsCollection })
        .where(({ s }) => eq(s.id, viewSessionId))
        .select(({ s }) => ({ id: s.id, messages: s.messages })),
    [viewSessionId],
  );
  const viewedSession = (viewedSessionQueryData as typeof viewedSessionQueryData)?.[0];

  // Sync viewedMessages whenever the viewed session updates — but only when
  // we're not streaming that session (the stream already owns the buffer).
  useEffect(() => {
    if (!viewedSession) return;
    if (viewSessionId === streamSessionId) return;
    const rawMsgs = Array.isArray(viewedSession.messages)
      ? viewedSession.messages
      : typeof viewedSession.messages === 'string'
        ? (JSON.parse(viewedSession.messages as string) as typeof viewedSession.messages)
        : [];
    setViewedMessages(storedToUi(rawMsgs));
  }, [viewedSession, viewSessionId, streamSessionId]);

  const messages = viewSessionId === streamSessionId ? streamMessages : viewedMessages;
  const isLoading = hookIsLoading && viewSessionId === streamSessionId;
  const currentTitle = messages.length === 0 ? 'New chat' : deriveTitle(messages);

  const stop = useCallback(() => {
    client.stop();
    setStreamSessionId(null);
  }, [client]);

  const startNewChat = useCallback(() => {
    const newId = createId();
    setViewedMessages([]);
    setViewSessionId(newId);

    if (!hookIsLoading) {
      setStreamSessionId(null);
      client.setMessagesManually([]);
    }
  }, [client, hookIsLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const currentId = viewSessionId;
      const prevStreamId = streamSessionId;

      if (currentId !== prevStreamId) {
        client.setMessagesManually(viewedMessages);
      }

      setStreamSessionId(currentId);
      await client.sendMessage(text, { sessionId: currentId });
    },
    [client, viewSessionId, streamSessionId, viewedMessages],
  );

  const loadSession = useCallback(
    (id: string) => {
      if (id === viewSessionId) return;
      setViewedMessages([]);
      setViewSessionId(id);
    },
    [viewSessionId],
  );

  const deleteSession = useCallback(
    (id: string) => {
      chatSessionsCollection.delete(id);
      if (id === viewSessionId) {
        startNewChat();
      }
    },
    [viewSessionId, startNewChat],
  );

  const { data: sessionsData } = useLiveQuery((q) =>
    q
      .from({ s: chatSessionsCollection })
      .select(({ s }) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt }))
      .orderBy(({ s }) => s.updatedAt, 'desc'),
  );
  const sessions = (sessionsData ?? []) as ChatContextValue['sessions'];

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      isLoading,
      error,
      sendMessage,
      stop,
      sessionId: viewSessionId,
      currentTitle,
      sessions,
      startNewChat,
      loadSession,
      deleteSession,
    }),
    [
      messages,
      isLoading,
      error,
      sendMessage,
      stop,
      viewSessionId,
      currentTitle,
      sessions,
      startNewChat,
      loadSession,
      deleteSession,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
