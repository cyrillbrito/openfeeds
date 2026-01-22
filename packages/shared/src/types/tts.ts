import type { z } from 'zod';
import type {
  ArticleAudioMetadataSchema,
  ArticleAudioResponseSchema,
  GenerateArticleAudioRequestSchema,
  GenerateArticleAudioResponseSchema,
  GetArticleAudioResponseSchema,
  WordTimingSchema,
} from '../schemas/tts';

export type WordTiming = z.infer<typeof WordTimingSchema>;
export type ArticleAudioMetadata = z.infer<typeof ArticleAudioMetadataSchema>;
export type ArticleAudioResponse = z.infer<typeof ArticleAudioResponseSchema>;
export type GetArticleAudioResponse = z.infer<typeof GetArticleAudioResponseSchema>;
export type GenerateArticleAudioRequest = z.infer<typeof GenerateArticleAudioRequestSchema>;
export type GenerateArticleAudioResponse = z.infer<typeof GenerateArticleAudioResponseSchema>;
