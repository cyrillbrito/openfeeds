import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { trackEvent } from './analytics';
import { getArticleWithContent } from './entities/article';
import { type ArticleAudioMetadata, type WordTiming } from './entities/tts.schema';
import { env } from './env';
import { NotFoundError, TtsNotConfiguredError } from './errors';

// Re-export client-safe types
export {
  WordTimingSchema,
  type WordTiming,
  ArticleAudioMetadataSchema,
  type ArticleAudioMetadata,
} from './entities/tts.schema';

/** Unreal Speech API response */
interface UnrealSpeechResponse {
  OutputUri: string;
  TimestampsUri: string;
}

/** Unreal Speech timestamp format */
interface UnrealSpeechTimestamp {
  word: string;
  start: number;
  end: number;
  text_offset: number;
}

/**
 * Check if TTS feature is properly configured.
 * Returns true if both dataPath and API key are set.
 */
export function isTtsConfigured(): boolean {
  return Boolean(env.DATA_PATH && env.UNREAL_SPEECH_API_KEY);
}

/**
 * Get the audio directory path for a user.
 * Throws TtsNotConfiguredError if dataPath is not set.
 */
function getAudioDir(userId: string): string {
  if (!env.DATA_PATH) {
    throw new TtsNotConfiguredError();
  }
  return join(env.DATA_PATH, 'audio', userId);
}

/**
 * Get the audio file path for an article
 */
function getAudioPath(userId: string, articleId: string): string {
  return join(getAudioDir(userId), `${articleId}.mp3`);
}

/**
 * Get the timestamps file path for an article
 */
function getTimestampsPath(userId: string, articleId: string): string {
  return join(getAudioDir(userId), `${articleId}.json`);
}

/**
 * Ensure the audio directory exists for a user
 */
async function ensureAudioDir(userId: string): Promise<void> {
  const audioDir = getAudioDir(userId);
  if (!existsSync(audioDir)) {
    await mkdir(audioDir, { recursive: true });
  }
}

/**
 * Check if audio exists for an article
 */
export function articleAudioExists(userId: string, articleId: string): boolean {
  const audioPath = getAudioPath(userId, articleId);
  const timestampsPath = getTimestampsPath(userId, articleId);
  return existsSync(audioPath) && existsSync(timestampsPath);
}

/**
 * Get audio metadata for an article
 */
export async function getArticleAudioMetadata(
  userId: string,
  articleId: string,
): Promise<ArticleAudioMetadata | null> {
  const timestampsPath = getTimestampsPath(userId, articleId);

  if (!existsSync(timestampsPath)) {
    return null;
  }

  const content = await readFile(timestampsPath, 'utf-8');
  return JSON.parse(content) as ArticleAudioMetadata;
}

/**
 * Get the audio file buffer for an article
 */
export async function getArticleAudioBuffer(
  userId: string,
  articleId: string,
): Promise<Buffer | null> {
  const audioPath = getAudioPath(userId, articleId);

  if (!existsSync(audioPath)) {
    return null;
  }

  return readFile(audioPath);
}

/**
 * Strip HTML tags and get plain text from article content
 */
function stripHtml(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Generate audio for an article using Unreal Speech API
 */
export async function generateArticleAudio(
  articleId: string,
  userId: string,
  options?: { voice?: string },
): Promise<ArticleAudioMetadata> {
  if (!env.DATA_PATH || !env.UNREAL_SPEECH_API_KEY) {
    throw new TtsNotConfiguredError();
  }
  const apiKey = env.UNREAL_SPEECH_API_KEY;

  // Check if audio already exists
  if (articleAudioExists(userId, articleId)) {
    const existing = await getArticleAudioMetadata(userId, articleId);
    if (existing) {
      return existing;
    }
  }

  // Get article content
  const article = await getArticleWithContent(articleId, userId);
  if (!article) {
    throw new NotFoundError();
  }

  // Get text content - prefer cleanContent, fallback to description
  const htmlContent = article.cleanContent || article.description || article.title;
  const textContent = stripHtml(htmlContent);

  if (!textContent || textContent.length === 0) {
    throw new Error('Article has no content to convert to speech');
  }

  // Unreal Speech /speech endpoint has a 3000 character limit
  // For longer content, we'd need to use /synthesisTasks or chunk it
  const truncatedContent = textContent.slice(0, 3000);

  const voice = options?.voice || env.TTS_DEFAULT_VOICE;

  // Call Unreal Speech API
  const response = await fetch('https://api.v8.unrealspeech.com/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Text: truncatedContent,
      VoiceId: voice,
      Bitrate: '192k',
      Speed: '0',
      Pitch: '1.0',
      TimestampType: 'word',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unreal Speech API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as UnrealSpeechResponse;

  // Fetch the audio file
  const audioResponse = await fetch(data.OutputUri);
  if (!audioResponse.ok) {
    throw new Error('Failed to fetch audio file from Unreal Speech');
  }
  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

  // Fetch the timestamps
  const timestampsResponse = await fetch(data.TimestampsUri);
  if (!timestampsResponse.ok) {
    throw new Error('Failed to fetch timestamps from Unreal Speech');
  }
  const timestamps = (await timestampsResponse.json()) as UnrealSpeechTimestamp[];

  // Convert timestamps to our format
  const wordTimings: WordTiming[] = timestamps.map((t) => ({
    word: t.word,
    start: t.start,
    end: t.end,
  }));

  // Calculate duration from the last timestamp
  const lastTimestamp = timestamps[timestamps.length - 1] as UnrealSpeechTimestamp | undefined;
  const duration = lastTimestamp?.end ?? 0;

  // Prepare metadata
  const metadata: ArticleAudioMetadata = {
    articleId,
    duration,
    wordTimings,
    createdAt: new Date(),
  };

  // Ensure audio directory exists
  await ensureAudioDir(userId);

  // Save audio file
  const audioPath = getAudioPath(userId, articleId);
  await writeFile(audioPath, audioBuffer);

  // Save timestamps/metadata
  const timestampsPath = getTimestampsPath(userId, articleId);
  await writeFile(timestampsPath, JSON.stringify(metadata, null, 2));

  trackEvent(userId, 'tts:audio_generate', {
    article_id: articleId,
    duration_ms: Math.round(duration * 1000),
  });

  return metadata;
}
