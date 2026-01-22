import type { WordTiming } from '@repo/shared/types';
import Headphones from 'lucide-solid/icons/headphones';
import Loader2 from 'lucide-solid/icons/loader-2';
import Pause from 'lucide-solid/icons/pause';
import Play from 'lucide-solid/icons/play';
import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { $$generateArticleAudio, $$getArticleAudio } from '~/entities/article-audio.server';
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

  let audioRef: HTMLAudioElement | undefined;
  let animationFrameId: number | undefined;

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
      audioRef.play();
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
    <div
      class="border-base-300 bg-base-200 mb-6 rounded-lg border p-4 transition-all"
      classList={{
        'sticky top-0 z-10 shadow-md': isSticky(),
      }}
    >
      {/* Hidden audio element */}
      <Show when={audioUrl()}>
        <audio
          ref={audioRef}
          src={audioUrl()!}
          onEnded={handleEnded}
          onLoadedMetadata={handleLoadedMetadata}
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
        </Show>

        <Show when={audio.audioState() === 'error'}>
          <div class="flex items-center gap-2">
            <span class="text-error text-sm">{error()}</span>
            <button class="btn btn-ghost btn-sm" onClick={generateAudio}>
              Retry
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
