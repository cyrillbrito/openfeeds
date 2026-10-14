import type { UIMessage } from '@tanstack/ai-client';
import { createContext, use } from 'react';

export type SessionSummary = { id: string; title: string; updatedAt: Date };

export interface ChatContextValue {
  messages: UIMessage[];
  /** True only when the active SSE stream belongs to the currently viewed session */
  isLoading: boolean;
  error: Error | undefined;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;

  // Session state
  sessionId: string;
  currentTitle: string;
  /** All chat sessions for the current user, ordered by updatedAt desc */
  sessions: SessionSummary[];

  // Actions
  startNewChat: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
}

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function useChatContext(): ChatContextValue {
  const ctx = use(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
