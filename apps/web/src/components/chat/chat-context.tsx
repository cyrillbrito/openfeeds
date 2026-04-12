import { createId } from '@repo/shared/utils';
import type { UIMessage } from '@tanstack/ai';
import { ChatClient } from '@tanstack/ai-client';
import { fetchServerSentEvents } from '@tanstack/ai-solid';
import { eq } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/solid-db';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  useContext,
} from 'solid-js';
import type { JSX } from 'solid-js';
import { chatSessionsCollection } from '~/entities/chat-sessions';
import { storedToUi } from './chat-utils';

interface ChatContextValue {
  messages: Accessor<UIMessage[]>;
  /** True only when the active SSE stream belongs to the currently viewed session */
  isLoading: Accessor<boolean>;
  error: Accessor<Error | undefined>;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;

  // Session state
  sessionId: Accessor<string>;
  currentTitle: Accessor<string>;

  // Actions
  startNewChat: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

const ChatContext = createContext<ChatContextValue>();

/**
 * Derive a display title from a message list.
 * Kept here (client-only) to drive the header title reactively from
 * the live stream — the server also computes the title on save.
 */
function deriveTitle(msgs: UIMessage[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const textPart = firstUser.parts.find((p) => p.type === 'text' && 'content' in p);
  if (!textPart || !('content' in textPart)) return 'New chat';
  const text = (textPart as { content: string }).content.trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export function ChatProvider(props: { children: JSX.Element }) {
  // The session the user is currently viewing in the UI
  const [viewSessionId, setViewSessionId] = createSignal(createId());
  // The session that owns the active SSE stream (null when idle)
  const [streamSessionId, setStreamSessionId] = createSignal<string | null>(null);
  // Snapshot of messages for the currently viewed session when NOT streaming it.
  // Kept as a signal so we can hydrate it from the collection reactively.
  const [viewedMessages, setViewedMessages] = createSignal<UIMessage[]>([]);

  // Reactively track the viewed session in the collection.
  // This re-runs whenever Electric delivers an update for this session,
  // so we never need an imperative .get() call.
  const viewedSessionQuery = useLiveQuery((q) =>
    q
      .from({ s: chatSessionsCollection })
      .where(({ s }) => eq(s.id, viewSessionId()))
      .select(({ s }) => ({ id: s.id, messages: s.messages })),
  );

  // viewedSessionQuery() returns an array — grab the first row.
  const viewedSession = createMemo(() => viewedSessionQuery()?.[0]);

  // Whenever the viewed session arrives or updates in the collection,
  // sync viewedMessages — but only when we're NOT streaming that session,
  // since the stream already owns the message buffer in that case.
  createEffect(
    on(viewedSession, (session) => {
      if (!session) return;
      if (viewSessionId() === streamSessionId()) {
        return;
      }
      const rawMsgs =
        typeof session.messages === 'string'
          ? (JSON.parse(session.messages as string) as typeof session.messages)
          : session.messages;
      setViewedMessages(storedToUi(rawMsgs));
    }),
  );

  // Signals wired from ChatClient callbacks
  const [streamMessages, setStreamMessages] = createSignal<UIMessage[]>([]);
  const [hookIsLoading, setHookIsLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | undefined>(undefined);

  // Create ChatClient directly so we can call sendMessage(text, { sessionId })
  // with a per-message body override — useChat doesn't expose this parameter.
  const client = new ChatClient({
    connection: fetchServerSentEvents('/api/chat'),
    onMessagesChange: (msgs) => {
      setStreamMessages(msgs);
    },
    onLoadingChange: (loading) => {
      setHookIsLoading(loading);
    },
    onErrorChange: (err) => {
      setError(err);
    },
  });

  onCleanup(() => client.stop());

  // What to display:
  // - If viewing the session that is actively streaming → show live stream.
  // - Otherwise → show the loaded snapshot (viewedMessages).
  // This keeps the stream running undisturbed when the user navigates away.
  const messages = createMemo(() =>
    viewSessionId() === streamSessionId() ? streamMessages() : viewedMessages(),
  );

  // isLoading is scoped to the currently viewed session so spinners and
  // disabled inputs don't appear when viewing a different session while a
  // background stream is running.
  const isLoading = createMemo(() => hookIsLoading() && viewSessionId() === streamSessionId());

  const currentTitle = () => {
    const msgs = messages();
    if (msgs.length === 0) return 'New chat';
    return deriveTitle(msgs);
  };

  async function sendMessage(text: string) {
    const currentId = viewSessionId();
    const prevStreamId = streamSessionId();

    // Before sending, populate the ChatClient's internal message buffer with
    // the viewed session's history so the server receives full conversation context.
    // Only needed when sending from a loaded session (not the active stream session).
    if (currentId !== prevStreamId) {
      client.setMessagesManually(viewedMessages());
    }

    // Tag the stream to this session before the async send begins
    setStreamSessionId(currentId);

    // Pass sessionId as a per-message body override — this takes priority over
    // the base body and is the only reliable way to send the correct session ID
    // since the user may have switched sessions since the client was created.
    await client.sendMessage(text, { sessionId: currentId });
  }

  function stop() {
    client.stop();
    setStreamSessionId(null);
  }

  function loadSession(id: string) {
    if (id === viewSessionId()) return;

    // Clear the viewed messages immediately so we don't flash stale content.
    // The reactive viewedSession effect will populate them once Electric delivers
    // the session (or immediately if it's already in the collection).
    setViewedMessages([]);

    // Switch the view — this also re-targets the viewedSession live query.
    setViewSessionId(id);
  }

  function deleteSession(id: string) {
    chatSessionsCollection.delete(id);
    if (id === viewSessionId()) {
      startNewChat();
    }
  }

  function startNewChat() {
    const newId = createId();
    setViewedMessages([]);
    setViewSessionId(newId);

    // Only reset the stream buffer when no stream is running.
    // If a stream is active on another session the user navigated away from,
    // leave it — it saves itself server-side in onFinish.
    if (!hookIsLoading()) {
      setStreamSessionId(null);
      client.setMessagesManually([]);
    }
  }

  const value: ChatContextValue = {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    sessionId: viewSessionId,
    currentTitle,
    startNewChat,
    loadSession,
    deleteSession,
  };

  return <ChatContext.Provider value={value}>{props.children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
