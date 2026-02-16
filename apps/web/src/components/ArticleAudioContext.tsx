import type { WordTiming } from '@repo/domain/client';
import { createContext, createSignal, useContext, type ParentProps } from 'solid-js';

type AudioState = 'idle' | 'loading' | 'generating' | 'ready' | 'playing' | 'paused' | 'error';

interface ArticleAudioContextValue {
  audioState: () => AudioState;
  setAudioState: (state: AudioState) => void;
  currentWordIndex: () => number;
  setCurrentWordIndex: (index: number) => void;
  wordTimings: () => WordTiming[];
  setWordTimings: (timings: WordTiming[]) => void;
  isHighlightingEnabled: () => boolean;
  // Seeking
  seekToWordIndex: (index: number) => void;
  onSeekRequest: (callback: (index: number) => void) => void;
}

const ArticleAudioContext = createContext<ArticleAudioContextValue>();

export function ArticleAudioProvider(props: ParentProps) {
  const [audioState, setAudioState] = createSignal<AudioState>('idle');
  const [currentWordIndex, setCurrentWordIndex] = createSignal<number>(-1);
  const [wordTimings, setWordTimings] = createSignal<WordTiming[]>([]);

  // Callback for seek requests - AudioPlayer will register this
  let seekCallback: ((index: number) => void) | null = null;

  const isHighlightingEnabled = () => {
    const state = audioState();
    return (state === 'playing' || state === 'paused') && wordTimings().length > 0;
  };

  const seekToWordIndex = (index: number) => {
    if (seekCallback) {
      seekCallback(index);
    }
  };

  const onSeekRequest = (callback: (index: number) => void) => {
    seekCallback = callback;
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
        seekToWordIndex,
        onSeekRequest,
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
