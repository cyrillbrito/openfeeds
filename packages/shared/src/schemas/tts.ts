import { z } from 'zod';

/** Word timing information from TTS provider */
export const WordTimingSchema = z.object({
  word: z.string(),
  start: z.number(), // seconds
  end: z.number(), // seconds
});

/** TTS audio metadata stored alongside the audio file */
export const ArticleAudioMetadataSchema = z.object({
  articleId: z.string(),
  duration: z.number(), // total duration in seconds
  wordTimings: z.array(WordTimingSchema),
  createdAt: z.coerce.date(),
});

/** Response when requesting article audio */
export const ArticleAudioResponseSchema = z.object({
  audioUrl: z.string(),
  duration: z.number(),
  wordTimings: z.array(WordTimingSchema),
});

/** Response when audio doesn't exist yet */
export const ArticleAudioNotFoundResponseSchema = z.object({
  exists: z.literal(false),
});

/** Combined response for audio endpoint */
export const GetArticleAudioResponseSchema = z.discriminatedUnion('exists', [
  ArticleAudioResponseSchema.extend({ exists: z.literal(true) }),
  ArticleAudioNotFoundResponseSchema,
]);

/** Request to generate audio for an article */
export const GenerateArticleAudioRequestSchema = z.object({
  voice: z.string().optional(), // optional voice override
});

/** Response after generating audio */
export const GenerateArticleAudioResponseSchema = z.object({
  success: z.boolean(),
  audioUrl: z.string().optional(),
  duration: z.number().optional(),
  wordTimings: z.array(WordTimingSchema).optional(),
  error: z.string().optional(),
});
