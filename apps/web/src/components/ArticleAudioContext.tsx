import type { WordTiming } from '@repo/domain/client';
import { createContext, use, useCallback, useRef, useState, type ReactNode } from 'react';

type AudioState = 'idle' | 'loading' | 'generating' | 'ready' | 'playing' | 'paused' | 'error';

interface ArticleAudioContextValue {
  audioState: AudioState;
  setAudioState: (state: AudioState) => void;
  currentWordIndex: number;
  setCurrentWordIndex: (index: number) => void;
  wordTimings: WordTiming[];
  setWordTimings: (timings: WordTiming[]) => void;
  isHighlightingEnabled: boolean;
  seekToWordIndex: (index: number) => void;
  onSeekRequest: (callback: (index: number) => void) => void;
}

const ArticleAudioContext = createContext<ArticleAudioContextValue | undefined>(undefined);

export function ArticleAudioProvider({ children }: { children: ReactNode }) {
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);

  const seekCallbackRef = useRef<((index: number) => void) | null>(null);

  const isHighlightingEnabled =
    (audioState === 'playing' || audioState === 'paused') && wordTimings.length > 0;

  const seekToWordIndex = useCallback((index: number) => {
    seekCallbackRef.current?.(index);
  }, []);

  const onSeekRequest = useCallback((callback: (index: number) => void) => {
    seekCallbackRef.current = callback;
  }, []);

  return (
    <ArticleAudioContext.Provider
      value={{
        audioState,
        setAudioState,
        currentWordIndex,
        setCurrentWordIndex,
        wordTimings,
        setWordTimings,
        isHighlightingEnabled,
        seekToWordIndex,
        onSeekRequest,
      }}
    >
      {children}
    </ArticleAudioContext.Provider>
  );
}

export function useArticleAudio() {
  const context = use(ArticleAudioContext);
  if (!context) {
    throw new Error('useArticleAudio must be used within ArticleAudioProvider');
  }
  return context;
}
