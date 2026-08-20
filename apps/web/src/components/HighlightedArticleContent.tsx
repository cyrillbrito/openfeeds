import type { WordTiming } from '@repo/domain/client';
import { useEffect, useMemo, useRef } from 'react';
import { useArticleAudio } from './ArticleAudioContext';

interface HighlightedArticleContentProps {
  html: string;
  className?: string;
}

/**
 * Renders article HTML content with word-level highlighting synchronized to audio playback.
 * Uses a floating highlight bubble that smoothly transitions between words.
 * Allows clicking on words to seek to that position in the audio.
 */
export function HighlightedArticleContent({ html, className }: HighlightedArticleContentProps) {
  const audio = useArticleAudio();
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const canSeek =
    (audio.audioState === 'ready' || audio.audioState === 'playing' || audio.audioState === 'paused') &&
    audio.wordTimings.length > 0;

  const processedHtml = useMemo(() => {
    const isSeekable =
      (audio.audioState === 'ready' ||
        audio.audioState === 'playing' ||
        audio.audioState === 'paused') &&
      audio.wordTimings.length > 0;
    if (!isSeekable) return html;
    return wrapWordsWithTimings(html, audio.wordTimings);
  }, [audio.audioState, audio.wordTimings, html]);

  const handleClick = (e: React.MouseEvent) => {
    if (!canSeek) return;
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
  useEffect(() => {
    const index = audio.currentWordIndex;
    if (!containerRef.current || !highlightRef.current || index < 0) {
      if (highlightRef.current) {
        highlightRef.current.style.opacity = '0';
      }
      return;
    }

    const wordSpan = containerRef.current.querySelector(`[data-word-index="${index}"]`) as HTMLElement;
    if (!wordSpan) {
      highlightRef.current.style.opacity = '0';
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const wordRect = wordSpan.getBoundingClientRect();

    highlightRef.current.style.opacity = '1';
    highlightRef.current.style.left = `${wordRect.left - containerRect.left - 4}px`;
    highlightRef.current.style.top = `${wordRect.top - containerRect.top - 2}px`;
    highlightRef.current.style.width = `${wordRect.width + 8}px`;
    highlightRef.current.style.height = `${wordRect.height + 4}px`;
  }, [audio.currentWordIndex]);

  return (
    <div className="relative">
      {/* Floating highlight bubble */}
      {audio.isHighlightingEnabled && (
        <div
          ref={highlightRef}
          className="bg-primary/20 pointer-events-none absolute rounded-md opacity-0 transition-all duration-150 ease-out"
          style={{ zIndex: 0 }}
        />
      )}

      {/* Article content */}
      <div
        ref={containerRef}
        className={`${className ?? ''}${canSeek ? ' seekable-content' : ''}`}
        style={{ position: 'relative', zIndex: 1 }}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
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

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
}

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

  const ttsWords = timings.map((t) => normalizeWord(t.word));
  let ttsIndex = 0;

  const LOOKAHEAD = 5;

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim()) return;

      const parts = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
        } else if (part) {
          const normalizedPart = normalizeWord(part);
          let matchedIndex = -1;

          if (normalizedPart && ttsIndex < ttsWords.length) {
            if (wordsMatch(normalizedPart, ttsWords[ttsIndex])) {
              matchedIndex = ttsIndex;
              ttsIndex++;
            } else {
              for (
                let ahead = 1;
                ahead <= LOOKAHEAD && ttsIndex + ahead < ttsWords.length;
                ahead++
              ) {
                if (wordsMatch(normalizedPart, ttsWords[ttsIndex + ahead])) {
                  ttsIndex = ttsIndex + ahead;
                  matchedIndex = ttsIndex;
                  ttsIndex++;
                  break;
                }
              }
            }
          }

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
