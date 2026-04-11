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
