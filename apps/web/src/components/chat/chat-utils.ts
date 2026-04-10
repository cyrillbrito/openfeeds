import type { StoredMessage } from '@repo/domain/client';
import type { UIMessage } from '@tanstack/ai';

/** Derive a title from the first user message */
export function deriveTitle(msgs: UIMessage[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';

  const textPart = firstUser.parts.find((p) => p.type === 'text' && 'content' in p);
  if (!textPart || !('content' in textPart)) return 'New chat';

  const text = (textPart as { content: string }).content.trim();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/** Download the current chat session as a JSON file */
export function downloadSession(sessionId: string, messages: UIMessage[]) {
  const payload = {
    sessionId,
    exportedAt: new Date().toISOString(),
    messages: messages.map(uiToStored),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${sessionId.slice(0, 8)}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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

/** Group chat sessions by time period */
export function groupByTimePeriod<T extends { updatedAt: Date | string }>(
  items: T[],
): { label: string; items: T[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const todayGroup: { label: string; items: T[] } = { label: 'Today', items: [] };
  const weekGroup: { label: string; items: T[] } = { label: 'Previous 7 days', items: [] };
  const olderGroup: { label: string; items: T[] } = { label: 'Older', items: [] };

  for (const item of items) {
    const d = typeof item.updatedAt === 'string' ? new Date(item.updatedAt) : item.updatedAt;
    if (d >= today) {
      todayGroup.items.push(item);
    } else if (d >= weekAgo) {
      weekGroup.items.push(item);
    } else {
      olderGroup.items.push(item);
    }
  }

  const groups = [todayGroup, weekGroup, olderGroup];

  return groups.filter((g) => g.items.length > 0);
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
