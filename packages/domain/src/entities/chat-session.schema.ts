import { z } from 'zod';

/** Stored message part — simplified for persistence (mirrors @tanstack/ai UIMessage structure) */
const StoredMessagePartSchema = z.object({
  type: z.string(),
  content: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  arguments: z.unknown().optional(),
  state: z.string().optional(),
  output: z.unknown().optional(),
});

const StoredMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  parts: z.array(StoredMessagePartSchema),
  createdAt: z.coerce.date().optional(),
});
export type StoredMessage = z.infer<typeof StoredMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  messages: z.array(StoredMessageSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

/** Used when listing sessions (no messages payload) */
export const ChatSessionSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ChatSessionSummary = z.infer<typeof ChatSessionSummarySchema>;

export const SaveChatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  messages: z.array(StoredMessageSchema),
});
export type SaveChatSessionInput = z.infer<typeof SaveChatSessionSchema>;
