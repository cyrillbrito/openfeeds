import type { WordTiming } from '@repo/shared/types';
import { createContext, createSignal, useContext, type ParentProps } from 'solid-js';

export type AudioState =
  | 'idle'
  | 'loading'
  | 'generating'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'error';

interface ArticleAudioContextValue {
  audioState: () => AudioState;
  setAudioState: (state: AudioState) => void;
  currentWordIndex: () => number;
  setCurrentWordIndex: (index: number) => void;
  wordTimings: () => WordTiming[];
  setWordTimings: (timings: WordTiming[]) => void;
  isHighlightingEnabled: () => boolean;
}

const ArticleAudioContext = createContext<ArticleAudioContextValue>();

export function ArticleAudioProvider(props: ParentProps) {
  const [audioState, setAudioState] = createSignal<AudioState>('idle');
  const [currentWordIndex, setCurrentWordIndex] = createSignal<number>(-1);
  const [wordTimings, setWordTimings] = createSignal<WordTiming[]>([]);

  const isHighlightingEnabled = () => {
    const state = audioState();
    return (state === 'playing' || state === 'paused') && wordTimings().length > 0;
  };

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
      }}
    >
      {props.children}
    </ArticleAudioContext.Provider>
  );
}

export function useArticleAudio() {
  const context = useContext(ArticleAudioContext);
  if (!context) {
    throw new Error('useArticleAudio must be used within ArticleAudioProvider');
  }
  return context;
}
