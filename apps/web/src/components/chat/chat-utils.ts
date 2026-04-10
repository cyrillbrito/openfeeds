import type { StoredMessage } from '@repo/domain/client';
import type { UIMessage } from '@tanstack/ai';

/** Lightweight markdown renderer (escapes HTML, then applies inline formatting) */
export function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
}

/** Derive a title from the first user message */
export function deriveTitle(msgs: UIMessage[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';

  const textPart = firstUser.parts.find((p) => p.type === 'text' && 'content' in p);
  if (!textPart || !('content' in textPart)) return 'New chat';

  const text = (textPart as { content: string }).content.trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/** Convert UIMessage to StoredMessage for persistence */
export function uiToStored(msg: UIMessage): StoredMessage {
  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: msg.parts.map((p) => {
      const part: StoredMessage['parts'][number] = { type: p.type };
      if ('content' in p) part.content = (p as { content: string }).content;
      if ('id' in p) part.id = (p as { id: string }).id;
      if ('name' in p) part.name = (p as { name: string }).name;
      if ('arguments' in p) part.arguments = (p as { arguments: unknown }).arguments;
      if ('state' in p) part.state = (p as { state: string }).state;
      if ('output' in p) part.output = (p as { output: unknown }).output;
      return part;
    }),
  };
}

/** Convert StoredMessage back to UIMessage for useChat */
export function storedToUi(msg: StoredMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: msg.parts as UIMessage['parts'],
    createdAt: msg.createdAt ?? new Date(),
  };
}

/** Simple relative date formatting */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
