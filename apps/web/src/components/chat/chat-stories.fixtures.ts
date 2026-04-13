/**
 * Shared UIMessage fixtures for AI chat Storybook stories.
 */
import type { UIMessage } from '@tanstack/ai';
import type { SessionSummary } from './chat-context.shared';

export const userMessage: UIMessage = {
  id: 'msg-1',
  role: 'user',
  parts: [{ type: 'text', content: 'What feeds do I follow?' }],
};

export const aiMessage: UIMessage = {
  id: 'msg-2',
  role: 'assistant',
  parts: [
    {
      type: 'text',
      content:
        'You currently follow **3 feeds**:\n\n| Feed | Articles |\n|---|---|\n| TechCrunch | 142 |\n| Hacker News | 89 |\n| The Verge | 67 |\n\nWould you like to manage any of these?',
    },
  ],
};

export const toolCallMessage: UIMessage = {
  id: 'msg-3',
  role: 'assistant',
  parts: [
    {
      type: 'tool-call',
      name: 'list_feeds',
      arguments: '{}',
      id: 'tc-1',
      state: 'input-complete',
      output: '[...]',
    },
    {
      type: 'text',
      content: 'You have **3 feeds** subscribed. Here they are:',
    },
  ],
};

export const conversation: UIMessage[] = [
  userMessage,
  aiMessage,
  {
    id: 'msg-4',
    role: 'user',
    parts: [{ type: 'text', content: 'Unfollow The Verge' }],
  },
  {
    id: 'msg-5',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        content:
          'Are you sure you want to unfollow **The Verge**? This will remove all its articles from your feed.',
      },
    ],
  },
];

export const emptyAssistantMessage: UIMessage = {
  id: 'msg-empty',
  role: 'assistant',
  parts: [],
};

/** Session fixtures for ConversationSwitcher / ChatTitleSwitcher stories */
const now = new Date();

export const sessionFixtures: SessionSummary[] = [
  {
    id: 'session-1',
    title: 'What feeds do I follow?',
    updatedAt: new Date(now.getTime() - 1000 * 60 * 5),
  },
  {
    id: 'session-2',
    title: 'Summarize my unread articles',
    updatedAt: new Date(now.getTime() - 1000 * 60 * 30),
  },
  {
    id: 'session-3',
    title: 'Help me find AI newsletters',
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    id: 'session-4',
    title: 'Explain RSS vs Atom format',
    updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
  },
];
