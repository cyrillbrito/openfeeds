import { z } from 'zod';

/**
 * A stored message is a ModelMessage from @tanstack/ai, persisted as-is.
 * We use z.record(z.unknown()) to avoid coupling to the @tanstack/ai types
 * here (this file is client-safe and @tanstack/ai types may not be available).
 * The full ModelMessage structure is preserved in the JSON column so nothing
 * is ever dropped on persistence.
 */
const StoredMessageSchema = z.record(z.string(), z.unknown());
export type StoredMessage = z.infer<typeof StoredMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  /** Messages stored as JSON text — parse on read */
  messages: z.string().transform((val) => JSON.parse(val) as Record<string, unknown>[]),
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
