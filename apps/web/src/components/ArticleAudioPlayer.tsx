import type { WordTiming } from '@repo/domain/client';
import { Headphones, Loader2, Pause, Play, Wifi } from 'lucide-solid';
import posthog from 'posthog-js';
import { createEffect, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import {
  $$generateArticleAudio,
  $$getArticleAudio,
  $$isTtsAvailable,
} from '~/entities/article-audio.functions';
import { useArticleAudio } from './ArticleAudioContext';

interface ArticleAudioPlayerProps {
  articleId: string;
}

export function ArticleAudioPlayer(props: ArticleAudioPlayerProps) {
  const audio = useArticleAudio();
  const [audioUrl, setAudioUrl] = createSignal<string | null>(null);
  const [localWordTimings, setLocalWordTimings] = createSignal<WordTiming[]>([]);
  const [duration, setDuration] = createSignal<number>(0);
  const [currentTime, setCurrentTime] = createSignal<number>(0);
  const [error, setError] = createSignal<string | null>(null);
  const [buffering, setBuffering] = createSignal(false);

  // Check if TTS is available on the server
  const [ttsAvailable] = createResource(() => $$isTtsAvailable());
  const isTtsAvailable = () => ttsAvailable()?.available ?? false;

  let audioRef: HTMLAudioElement | undefined;
  let animationFrameId: number | undefined;

  // Register seek handler so HighlightedArticleContent can request seeks
  onMount(() => {
    audio.onSeekRequest((wordIndex) => {
      const timings = localWordTimings();
      if (!audioRef || wordIndex < 0 || wordIndex >= timings.length) return;

      const timing = timings[wordIndex];
      if (timing) {
        audioRef.currentTime = timing.start;
        setCurrentTime(timing.start);
        audio.setCurrentWordIndex(wordIndex);

        // Start playing if not already
        if (audio.audioState() !== 'playing') {
          void audioRef.play();
          audio.setAudioState('playing');
          startProgressLoop();
        }
      }
    });
  });

  // Use requestAnimationFrame for smooth progress updates
  const updateProgress = () => {
    if (audioRef && audio.audioState() === 'playing') {
      const time = audioRef.currentTime;
      setCurrentTime(time);

      // Find current word based on time
      const timings = localWordTimings();
      let foundIndex = -1;
      for (let i = 0; i < timings.length; i++) {
        const timing = timings[i]!;
        if (time >= timing.start && time <= timing.end) {
          foundIndex = i;
          break;
        }
      }
      audio.setCurrentWordIndex(foundIndex);

      animationFrameId = requestAnimationFrame(updateProgress);
    }
  };

  const startProgressLoop = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(updateProgress);
  };

  const stopProgressLoop = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = undefined;
    }
  };

  // Check if audio already exists on mount
  createEffect(async () => {
    const articleId = props.articleId;
    if (!articleId) return;

    try {
      const result = await $$getArticleAudio({ data: { articleId } });
      if (result.exists) {
        setAudioUrl(result.audioUrl);
        setLocalWordTimings(result.wordTimings);
        audio.setWordTimings(result.wordTimings);
        setDuration(result.duration);
        audio.setAudioState('ready');
      }
    } catch {
      // Audio doesn't exist yet, that's fine
    }
  });

  const generateAudio = async () => {
    audio.setAudioState('generating');
    setError(null);

    try {
      const result = await $$generateArticleAudio({ data: { articleId: props.articleId } });
      setAudioUrl(result.audioUrl);
      setLocalWordTimings(result.wordTimings);
      audio.setWordTimings(result.wordTimings);
      setDuration(result.duration);
      audio.setAudioState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
      audio.setAudioState('error');
    }
  };

  const togglePlayPause = () => {
    if (!audioRef) return;

    if (audio.audioState() === 'playing') {
      audioRef.pause();
      audio.setAudioState('paused');
      stopProgressLoop();
    } else {
      void audioRef.play();
      audio.setAudioState('playing');
      startProgressLoop();
    }
  };

  const handleEnded = () => {
    stopProgressLoop();
    audio.setAudioState('ready');
    audio.setCurrentWordIndex(-1);
    setCurrentTime(0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef) {
      setDuration(audioRef.duration);
    }
  };

  const handleAudioError = () => {
    stopProgressLoop();
    const mediaError = audioRef?.error;
    const errorMsg =
      mediaError?.code === MediaError.MEDIA_ERR_NETWORK
        ? 'Audio download failed — check your connection'
        : 'Audio playback failed';
    setError(errorMsg);
    audio.setAudioState('error');
    posthog.captureException(new Error(errorMsg), {
      context: 'audio.playback',
      mediaErrorCode: mediaError?.code,
      mediaErrorMessage: mediaError?.message,
    });
  };

  onCleanup(() => {
    stopProgressLoop();
    if (audioRef) {
      audioRef.pause();
    }
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Player becomes sticky once audio is ready (not just idle)
  const isSticky = () => {
    const state = audio.audioState();
    return state === 'ready' || state === 'playing' || state === 'paused';
  };

  return (
    <Show when={!ttsAvailable.loading && isTtsAvailable()}>
      <div
        class="border-base-300 bg-base-200 mb-6 rounded-lg border p-4 transition-all print:hidden"
        classList={{
          'sticky top-18 z-10 shadow-md': isSticky(),
        }}
      >
        {/* Hidden audio element */}
        <Show when={audioUrl()}>
          <audio
            ref={(el) => (audioRef = el)}
            src={audioUrl()!}
            onEnded={handleEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleAudioError}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onStalled={() => setBuffering(true)}
            preload="metadata"
          />
        </Show>

        <div class="flex items-center gap-4">
          {/* Play/Generate button */}
          <Show when={audio.audioState() === 'idle'}>
            <button
              class="btn btn-primary btn-sm gap-2"
              onClick={generateAudio}
              title="Generate audio for this article"
            >
              <Headphones size={18} />
              <span>Listen</span>
            </button>
          </Show>

          <Show when={audio.audioState() === 'generating'}>
            <button class="btn btn-primary btn-sm gap-2" disabled>
              <Loader2 size={18} class="animate-spin" />
              <span>Generating...</span>
            </button>
          </Show>

          <Show when={audio.audioState() === 'loading'}>
            <button class="btn btn-primary btn-sm gap-2" disabled>
              <Loader2 size={18} class="animate-spin" />
              <span>Loading...</span>
            </button>
          </Show>

          <Show
            when={
              audio.audioState() === 'ready' ||
              audio.audioState() === 'playing' ||
              audio.audioState() === 'paused'
            }
          >
            <button class="btn btn-primary btn-circle btn-sm" onClick={togglePlayPause}>
              <Show when={audio.audioState() === 'playing'} fallback={<Play size={18} />}>
                <Pause size={18} />
              </Show>
            </button>

            {/* Progress bar */}
            <div class="flex flex-1 items-center gap-2">
              <span class="text-base-content/60 w-10 text-xs tabular-nums">
                {formatTime(currentTime())}
              </span>
              <input
                type="range"
                min="0"
                max={duration()}
                value={currentTime()}
                class="range range-primary range-xs flex-1"
                onInput={(e) => {
                  if (audioRef) {
                    audioRef.currentTime = Number(e.currentTarget.value);
                  }
                }}
              />
              <span class="text-base-content/60 w-10 text-xs tabular-nums">
                {formatTime(duration())}
              </span>
            </div>

            <Show when={buffering()}>
              <span class="text-warning flex items-center gap-1 text-xs" title="Slow connection">
                <Wifi size={14} />
                Buffering...
              </span>
            </Show>
          </Show>

          <Show when={audio.audioState() === 'error'}>
            <div class="flex items-center gap-2">
              <span class="text-error text-sm">{error()}</span>
              <Show
                when={audioUrl()}
                fallback={
                  <button class="btn btn-ghost btn-sm" onClick={generateAudio}>
                    Retry
                  </button>
                }
              >
                <button
                  class="btn btn-ghost btn-sm"
                  onClick={() => {
                    setError(null);
                    audio.setAudioState('ready');
                  }}
                >
                  Retry
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
