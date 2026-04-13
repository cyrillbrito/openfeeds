import type { UIMessage } from '@tanstack/ai';
import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export type SessionSummary = { id: string; title: string; updatedAt: Date };

export interface ChatContextValue {
  messages: Accessor<UIMessage[]>;
  /** True only when the active SSE stream belongs to the currently viewed session */
  isLoading: Accessor<boolean>;
  error: Accessor<Error | undefined>;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;

  // Session state
  sessionId: Accessor<string>;
  currentTitle: Accessor<string>;
  /** All chat sessions for the current user, ordered by updatedAt desc */
  sessions: Accessor<SessionSummary[]>;

  // Actions
  startNewChat: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

export const ChatContext = createContext<ChatContextValue>();

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
