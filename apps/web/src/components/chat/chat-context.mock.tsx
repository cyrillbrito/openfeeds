/**
 * Mock ChatProvider for Storybook stories.
 *
 * Provides a fake ChatContextValue using the same ChatContext symbol as the real
 * provider, so components calling `useChatContext()` work without ChatClient,
 * Electric SQL, or SSE connections.
 *
 * Pass Storybook `fn()` spies via the `on*` props to see actions in the
 * Actions panel and assert calls in play functions.
 *
 * Imports from chat-context.shared (lightweight, no server deps).
 */
import type { UIMessage } from '@tanstack/ai';
import { createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { ChatContext } from './chat-context.shared';
import type { SessionSummary } from './chat-context.shared';

export interface MockChatProviderProps {
  messages?: UIMessage[];
  isLoading?: boolean;
  error?: Error;
  currentTitle?: string;
  sessionId?: string;
  sessions?: SessionSummary[];
  /** Override for sendMessage — pass `fn()` from storybook/test to log to Actions panel */
  onSendMessage?: (text: string) => void | Promise<void>;
  /** Override for stop */
  onStop?: () => void;
  /** Override for startNewChat */
  onStartNewChat?: () => void;
  /** Override for loadSession */
  onLoadSession?: (id: string) => void;
  /** Override for deleteSession */
  onDeleteSession?: (id: string) => void;
  children: JSX.Element;
}

const noop = () => {};

export function MockChatProvider(props: MockChatProviderProps) {
  const [messages] = createSignal(props.messages ?? []);
  const [isLoading] = createSignal(props.isLoading ?? false);
  const [error] = createSignal<Error | undefined>(props.error);
  const [sessionId] = createSignal(props.sessionId ?? 'mock-session-id');
  const [sessions] = createSignal(props.sessions ?? []);

  const value = {
    messages,
    isLoading,
    error,
    sendMessage: async (text: string) => {
      (props.onSendMessage ?? noop)(text);
    },
    stop: () => {
      (props.onStop ?? noop)();
    },
    sessionId,
    currentTitle: () => props.currentTitle ?? 'New chat',
    sessions,
    startNewChat: () => {
      (props.onStartNewChat ?? noop)();
    },
    loadSession: (id: string) => {
      (props.onLoadSession ?? noop)(id);
    },
    deleteSession: (id: string) => {
      (props.onDeleteSession ?? noop)(id);
    },
  };

  return <ChatContext.Provider value={value}>{props.children}</ChatContext.Provider>;
}
