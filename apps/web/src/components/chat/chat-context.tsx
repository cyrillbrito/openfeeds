import type { ChatSession } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import type { UIMessage } from '@tanstack/ai';
import { fetchServerSentEvents, useChat } from '@tanstack/ai-solid';
import { type Accessor, createContext, createMemo, createSignal, useContext } from 'solid-js';
import type { JSX } from 'solid-js';
import { chatSessionsCollection, useChatSessions } from '~/entities/chat-sessions';
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
  sessions: Accessor<ChatSession[] | undefined>;

  // Actions
  startNewChat: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

const ChatContext = createContext<ChatContextValue>();

export function ChatProvider(props: { children: JSX.Element }) {
  const [sessionId, setSessionId] = createSignal(createId());
  const sessionsQuery = useChatSessions();

  const sessions = createMemo(() => sessionsQuery());

  const { messages, sendMessage, isLoading, setMessages, error, stop } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    onFinish: () => {
      saveCurrentSession();
    },
  });

  const currentTitle = () => {
    const msgs = messages();
    if (msgs.length === 0) return 'New chat';
    return deriveTitle(msgs);
  };

  function saveCurrentSession() {
    const msgs = messages();
    if (msgs.length === 0) return;

    const title = deriveTitle(msgs);
    const id = sessionId();
    const storedMessages = msgs.map(uiToStored);

    // Check if session already exists in the collection
    const existing = chatSessionsCollection.get(id);
    if (existing) {
      chatSessionsCollection.update(id, (draft) => {
        draft.title = title;
        draft.messages = storedMessages;
      });
    } else {
      chatSessionsCollection.insert({
        id,
        userId: '', // Server will set the real userId
        title,
        messages: storedMessages,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  function loadSession(id: string) {
    const session = chatSessionsCollection.get(id);
    if (!session || session.messages.length === 0) return;

    setSessionId(id);
    setMessages(session.messages.map(storedToUi));
  }

  function deleteSession(id: string) {
    chatSessionsCollection.delete(id);
    if (id === sessionId()) {
      startNewChat();
    }
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
    sessions,
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
