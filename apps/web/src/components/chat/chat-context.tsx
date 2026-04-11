import { createId } from '@repo/shared/utils';
import type { UIMessage } from '@tanstack/ai';
import { fetchServerSentEvents, useChat } from '@tanstack/ai-solid';
import { type Accessor, createContext, createMemo, createSignal, useContext } from 'solid-js';
import type { JSX } from 'solid-js';
import { chatSessionsCollection } from '~/entities/chat-sessions';
import { deriveTitle, storedToUi, uiToStored } from './chat-utils';

interface ChatContextValue {
  // Displayed messages — the viewed session, or live stream if viewing the active one
  messages: Accessor<UIMessage[]>;
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

export function ChatProvider(props: { children: JSX.Element }) {
  // The session the user is currently viewing
  const [viewSessionId, setViewSessionId] = createSignal(createId());
  // The session the active stream belongs to (set when sendMessage is called)
  const [streamSessionId, setStreamSessionId] = createSignal<string | null>(null);
  // Messages for the currently viewed non-streaming session
  const [viewedMessages, setViewedMessages] = createSignal<UIMessage[]>([]);

  const {
    messages: streamMessages,
    sendMessage: rawSendMessage,
    isLoading,
    setMessages,
    error,
    stop,
  } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    onFinish: () => {
      saveStreamSession();
    },
  });

  // What to show: live stream if viewing the streaming session, otherwise the loaded snapshot
  const messages = createMemo(() => {
    return viewSessionId() === streamSessionId() ? streamMessages() : viewedMessages();
  });

  const currentTitle = () => {
    const msgs = messages();
    if (msgs.length === 0) return 'New chat';
    return deriveTitle(msgs);
  };

  function saveStreamSession() {
    const msgs = streamMessages();
    if (msgs.length === 0) return;

    const id = streamSessionId();
    if (!id) return;

    const title = deriveTitle(msgs);
    const storedMsgs = msgs.map(uiToStored);

    const existing = chatSessionsCollection.get(id);
    if (existing) {
      chatSessionsCollection.update(id, (draft) => {
        draft.title = title;
        draft.messages = storedMsgs;
      });
    } else {
      chatSessionsCollection.insert({
        id,
        userId: '',
        title,
        messages: storedMsgs,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async function sendMessage(text: string) {
    // Attach the stream to the current view session before sending
    setStreamSessionId(viewSessionId());
    await rawSendMessage(text);
  }

  function loadSession(id: string) {
    const session = chatSessionsCollection.get(id);
    if (!session) return;

    // Electric sends jsonb columns as JSON strings — defensively parse if needed
    const msgs =
      typeof session.messages === 'string'
        ? (JSON.parse(session.messages as string) as typeof session.messages)
        : session.messages;

    setViewSessionId(id);
    setViewedMessages(msgs.map(storedToUi));
  }

  function deleteSession(id: string) {
    chatSessionsCollection.delete(id);
    if (id === viewSessionId()) {
      startNewChat();
    }
  }

  function startNewChat() {
    const newId = createId();
    setViewSessionId(newId);
    setViewedMessages([]);
    // Only stop + reset the stream if it's idle — don't kill an active stream
    if (!isLoading()) {
      setStreamSessionId(null);
      setMessages([]);
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
