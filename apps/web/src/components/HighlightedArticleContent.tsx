import type { WordTiming } from '@repo/shared/types';
import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';
import { useArticleAudio } from './ArticleAudioContext';

interface HighlightedArticleContentProps {
  html: string;
  class?: string;
}

/**
 * Renders article HTML content with word-level highlighting synchronized to audio playback.
 * Uses a floating highlight bubble that smoothly transitions between words.
 * Allows clicking on words to seek to that position in the audio.
 */
export function HighlightedArticleContent(props: HighlightedArticleContentProps) {
  const audio = useArticleAudio();
  let containerRef: HTMLDivElement | undefined;
  let highlightRef: HTMLDivElement | undefined;
  const [isInitialized, setIsInitialized] = createSignal(false);

  // Check if audio is ready for interaction (can seek)
  const canSeek = () => {
    const state = audio.audioState();
    return (
      (state === 'ready' || state === 'playing' || state === 'paused') &&
      audio.wordTimings().length > 0
    );
  };

  // Process HTML to wrap words in spans when seeking/highlighting is available
  const processedHtml = createMemo(() => {
    const timings = audio.wordTimings();
    if (!canSeek() || timings.length === 0) {
      return props.html;
    }

    // Use TTS word list to guide HTML wrapping
    return wrapWordsWithTimings(props.html, timings);
  });

  // Handle click on words to seek
  const handleClick = (e: MouseEvent) => {
    if (!canSeek()) return;

    // Find the clicked word span
    const target = e.target as HTMLElement;
    const wordIndex = target.getAttribute('data-word-index');

    if (wordIndex !== null) {
      const index = parseInt(wordIndex, 10);
      if (!isNaN(index)) {
        audio.seekToWordIndex(index);
      }
    }
  };

  // Update highlight position when current word changes
  createEffect(() => {
    const index = audio.currentWordIndex();
    if (!containerRef || !highlightRef || index < 0) {
      if (highlightRef) {
        highlightRef.style.opacity = '0';
      }
      return;
    }

    const wordSpan = containerRef.querySelector(`[data-word-index="${index}"]`) as HTMLElement;
    if (!wordSpan) {
      highlightRef.style.opacity = '0';
      return;
    }

    const containerRect = containerRef.getBoundingClientRect();
    const wordRect = wordSpan.getBoundingClientRect();

    // Position the highlight behind the word
    highlightRef.style.opacity = '1';
    highlightRef.style.left = `${wordRect.left - containerRect.left - 4}px`;
    highlightRef.style.top = `${wordRect.top - containerRect.top - 2}px`;
    highlightRef.style.width = `${wordRect.width + 8}px`;
    highlightRef.style.height = `${wordRect.height + 4}px`;
  });

  onMount(() => {
    setIsInitialized(true);
  });

  // Update innerHTML when processedHtml changes (SolidJS innerHTML doesn't auto-update)
  createEffect(() => {
    if (containerRef && isInitialized()) {
      containerRef.innerHTML = processedHtml();
    }
  });

  return (
    <div class="relative">
      {/* Floating highlight bubble */}
      <Show when={audio.isHighlightingEnabled()}>
        <div
          ref={highlightRef}
          class="bg-primary/20 pointer-events-none absolute rounded-md opacity-0 transition-all duration-150 ease-out"
          style={{ 'z-index': 0 }}
        />
      </Show>

      {/* Article content */}
      <div
        ref={containerRef}
        class={props.class}
        classList={{
          'seekable-content': canSeek(),
        }}
        style={{ position: 'relative', 'z-index': 1 }}
        onClick={handleClick}
      />

      {/* Hover styles for seekable words */}
      <style>{`
        .seekable-content [data-word-index] {
          cursor: pointer;
          border-radius: 2px;
        }
        .seekable-content [data-word-index]:hover {
          background-color: color-mix(in oklab, var(--color-primary) 10%, transparent);
        }
      `}</style>
    </div>
  );
}

/**
 * Normalize a word for comparison - lowercase and strip punctuation from edges
 */
function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
}

/**
 * Check if two normalized words match (with some flexibility)
 */
function wordsMatch(htmlWord: string, ttsWord: string): boolean {
  if (!htmlWord || !ttsWord) return false;
  return htmlWord === ttsWord || htmlWord.includes(ttsWord) || ttsWord.includes(htmlWord);
}

/**
 * Wraps words in HTML using TTS word timings as the source of truth.
 * This ensures the word indices match between audio and display.
 */
function wrapWordsWithTimings(html: string, timings: WordTiming[]): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  // Build a list of normalized TTS words for matching
  const ttsWords = timings.map((t) => normalizeWord(t.word));
  let ttsIndex = 0;

  // How many TTS words to look ahead when trying to resync after a mismatch
  const LOOKAHEAD = 5;

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim()) return;

      // Split into words and whitespace, preserving order
      const parts = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          // Whitespace - keep as text
          fragment.appendChild(document.createTextNode(part));
        } else if (part) {
          // This is a word from the HTML - try to match it with TTS words
          const normalizedPart = normalizeWord(part);
          let matchedIndex = -1;

          if (normalizedPart && ttsIndex < ttsWords.length) {
            // First, try exact match at current position
            if (wordsMatch(normalizedPart, ttsWords[ttsIndex]!)) {
              matchedIndex = ttsIndex;
              ttsIndex++;
            } else {
              // Mismatch - look ahead to try to resync
              for (
                let ahead = 1;
                ahead <= LOOKAHEAD && ttsIndex + ahead < ttsWords.length;
                ahead++
              ) {
                if (wordsMatch(normalizedPart, ttsWords[ttsIndex + ahead]!)) {
                  // Found a match ahead - skip to it
                  ttsIndex = ttsIndex + ahead;
                  matchedIndex = ttsIndex;
                  ttsIndex++;
                  break;
                }
              }
            }
          }

          // Create span with word index if matched
          const span = document.createElement('span');
          if (matchedIndex >= 0) {
            span.setAttribute('data-word-index', String(matchedIndex));
          }
          span.textContent = part;
          fragment.appendChild(span);
        }
      }

      node.parentNode?.replaceChild(fragment, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = (node as Element).tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
        return;
      }

      const children = Array.from(node.childNodes);
      for (const child of children) {
        processNode(child);
      }
    }
  }

  const content = template.content;
  const children = Array.from(content.childNodes);
  for (const child of children) {
    processNode(child);
  }

  const wrapper = document.createElement('div');
  wrapper.appendChild(content.cloneNode(true));
  return wrapper.innerHTML;
}
