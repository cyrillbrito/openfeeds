import { z } from 'zod';

/** Word timing information from TTS provider */
export const WordTimingSchema = z.object({
  word: z.string(),
  start: z.number(), // seconds
  end: z.number(), // seconds
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

/** TTS audio metadata stored alongside the audio file */
export const ArticleAudioMetadataSchema = z.object({
  articleId: z.string(),
  duration: z.number(), // total duration in seconds
  wordTimings: z.array(WordTimingSchema),
  createdAt: z.iso.datetime(),
});
export type ArticleAudioMetadata = z.infer<typeof ArticleAudioMetadataSchema>;
