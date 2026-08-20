import type { WordTiming } from '@repo/domain/client';
import { Headphones, Loader2, Pause, Play, Wifi } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { api, unwrap } from '~/lib/api-client';
import { useArticleAudio } from './ArticleAudioContext';

interface ArticleAudioPlayerProps {
  articleId: string;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ArticleAudioPlayer({ articleId }: ArticleAudioPlayerProps) {
  const audio = useArticleAudio();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [localWordTimings, setLocalWordTimings] = useState<WordTiming[]>([]);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null);
  const [ttsLoading, setTtsLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameIdRef = useRef<number | undefined>(undefined);

  // Refs for values accessed inside the rAF loop (avoids stale closures)
  const audioStateRef = useRef(audio.audioState);
  const localWordTimingsRef = useRef(localWordTimings);
  audioStateRef.current = audio.audioState;
  localWordTimingsRef.current = localWordTimings;

  const updateProgressRef = useRef<(() => void) | undefined>(undefined);
  updateProgressRef.current = () => {
    if (audioRef.current && audioStateRef.current === 'playing') {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);

      const timings = localWordTimingsRef.current;
      let foundIndex = -1;
      for (let i = 0; i < timings.length; i++) {
        const timing = timings[i];
        if (time >= timing.start && time <= timing.end) {
          foundIndex = i;
          break;
        }
      }
      audio.setCurrentWordIndex(foundIndex);

      animationFrameIdRef.current = requestAnimationFrame(() => updateProgressRef.current?.());
    }
  };

  const startProgressLoop = () => {
    if (animationFrameIdRef.current !== undefined) cancelAnimationFrame(animationFrameIdRef.current);
    animationFrameIdRef.current = requestAnimationFrame(() => updateProgressRef.current?.());
  };

  const stopProgressLoop = () => {
    if (animationFrameIdRef.current !== undefined) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = undefined;
    }
  };

  useEffect(() => {
    void unwrap(api.api['article-audio'].available.$get({}))
      .then((result) => setTtsAvailable(result.available))
      .catch(() => setTtsAvailable(false))
      .finally(() => setTtsLoading(false));
  }, []);

  // Register seek handler once — uses refs for always-fresh values
  useEffect(() => {
    audio.onSeekRequest((wordIndex) => {
      const timings = localWordTimingsRef.current;
      if (!audioRef.current || wordIndex < 0 || wordIndex >= timings.length) return;

      const timing = timings[wordIndex];
      if (timing) {
        audioRef.current.currentTime = timing.start;
        setCurrentTime(timing.start);
        audio.setCurrentWordIndex(wordIndex);

        if (audioStateRef.current !== 'playing') {
          void audioRef.current.play();
          audio.setAudioState('playing');
          startProgressLoop();
        }
      }
    });
  }, []);

  // Check if audio already exists on the server
  useEffect(() => {
    if (!articleId) return;

    void (async () => {
      try {
        const result = await unwrap(api.api['article-audio'].metadata.$get({ query: { articleId } }));
        if (result.exists) {
          setAudioUrl(result.audioUrl);
          setLocalWordTimings(result.wordTimings);
          audio.setWordTimings(result.wordTimings);
          setDuration(result.duration);
          audio.setAudioState('ready');
        }
      } catch {
        // Audio doesn't exist yet — expected for articles without generated audio
      }
    })();
  }, [articleId]);

  useEffect(() => {
    return () => {
      stopProgressLoop();
      audioRef.current?.pause();
    };
  }, []);

  const generateAudio = async () => {
    audio.setAudioState('generating');
    setError(null);

    try {
      const result = await unwrap(
        api.api['article-audio'].generate.$post({ json: { articleId } }),
      );
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
    if (!audioRef.current) return;

    if (audio.audioState === 'playing') {
      audioRef.current.pause();
      audio.setAudioState('paused');
      stopProgressLoop();
    } else {
      void audioRef.current.play();
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
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioError = () => {
    stopProgressLoop();
    const mediaError = audioRef.current?.error;
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

  if (ttsLoading || !ttsAvailable) return null;

  const isSticky =
    audio.audioState === 'ready' || audio.audioState === 'playing' || audio.audioState === 'paused';

  return (
    <div
      className={twMerge(
        'border-base-300 bg-base-200 mb-6 rounded-lg border p-4 transition-all print:hidden',
        isSticky && 'sticky top-18 z-10 shadow-md',
      )}
    >
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleEnded}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleAudioError}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onStalled={() => setBuffering(true)}
          preload="metadata"
        />
      )}

      <div className="flex items-center gap-4">
        {audio.audioState === 'idle' && (
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={generateAudio}
            title="Generate audio for this article"
          >
            <Headphones size={18} />
            <span>Listen</span>
          </button>
        )}

        {audio.audioState === 'generating' && (
          <button className="btn btn-primary btn-sm gap-2" disabled>
            <Loader2 size={18} className="animate-spin" />
            <span>Generating...</span>
          </button>
        )}

        {audio.audioState === 'loading' && (
          <button className="btn btn-primary btn-sm gap-2" disabled>
            <Loader2 size={18} className="animate-spin" />
            <span>Loading...</span>
          </button>
        )}

        {(audio.audioState === 'ready' ||
          audio.audioState === 'playing' ||
          audio.audioState === 'paused') && (
          <>
            <button className="btn btn-primary btn-circle btn-sm" onClick={togglePlayPause}>
              {audio.audioState === 'playing' ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <div className="flex flex-1 items-center gap-2">
              <span className="text-base-content/60 w-10 text-xs tabular-nums">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                className="range range-primary range-xs flex-1"
                onChange={(e) => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Number(e.currentTarget.value);
                  }
                }}
              />
              <span className="text-base-content/60 w-10 text-xs tabular-nums">
                {formatTime(duration)}
              </span>
            </div>

            {buffering && (
              <span
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                title="Slow connection"
              >
                <Wifi size={14} />
                Buffering...
              </span>
            )}
          </>
        )}

        {audio.audioState === 'error' && (
          <div className="flex items-center gap-2">
            <span className="text-error text-sm">{error}</span>
            {audioUrl ? (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setError(null);
                  audio.setAudioState('ready');
                }}
              >
                Retry
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={generateAudio}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
