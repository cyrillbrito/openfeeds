import type { ChatSessionSummary, StoredMessage } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import type { UIMessage } from '@tanstack/ai';
import { fetchServerSentEvents, useChat } from '@tanstack/ai-solid';
import { type Accessor, createContext, createResource, createSignal, useContext } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  $$deleteChatSession,
  $$listChatSessions,
  $$loadChatSession,
  $$saveChatSession,
} from '~/entities/chat-sessions.functions';
import { deriveTitle, storedToUi, uiToStored } from './chat-utils';

interface ChatContextValue {
  // useChat state
  messages: Accessor<UIMessage[]>;
  isLoading: Accessor<boolean>;
  error: Accessor<Error | undefined>;
  setMessages: (msgs: UIMessage[]) => void;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;

  // Session state
  sessionId: Accessor<string>;
  currentTitle: Accessor<string>;
  sessions: Accessor<ChatSessionSummary[] | undefined>;
  refetchSessions: () => void;

  // Actions
  startNewChat: () => void;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue>();

export function ChatProvider(props: { children: JSX.Element }) {
  const [sessionId, setSessionId] = createSignal(createId());

  const [sessions, { refetch: refetchSessions }] = createResource(async () => {
    return $$listChatSessions();
  });

  const { messages, sendMessage, isLoading, setMessages, error, stop } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    onFinish: () => {
      void saveCurrentSession();
    },
  });

  const currentTitle = () => {
    const msgs = messages();
    if (msgs.length === 0) return 'New chat';
    return deriveTitle(msgs);
  };

  async function saveCurrentSession() {
    const msgs = messages();
    if (msgs.length === 0) return;

    const title = deriveTitle(msgs);
    await $$saveChatSession({
      data: {
        id: sessionId(),
        title,
        messages: msgs.map(uiToStored),
      },
    });
    void refetchSessions();
  }

  async function loadSession(id: string) {
    const result = (await $$loadChatSession({ data: id })) as {
      id: string;
      title: string;
      messages: StoredMessage[];
    };
    if (result.messages.length === 0) return;

    setSessionId(id);
    setMessages(result.messages.map(storedToUi));
  }

  async function deleteSession(id: string) {
    await $$deleteChatSession({ data: { id } });
    if (id === sessionId()) {
      startNewChat();
    }
    void refetchSessions();
  }

  function startNewChat() {
    setSessionId(createId());
    setMessages([]);
  }

  const value: ChatContextValue = {
    messages,
    isLoading,
    error,
    setMessages,
    sendMessage,
    stop,
    sessionId,
    currentTitle,
    sessions: () => sessions.latest,
    refetchSessions: () => void refetchSessions(),
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
