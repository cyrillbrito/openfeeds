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
    if (!canSeek() || audio.wordTimings().length === 0) {
      return props.html;
    }

    // We need to wrap text nodes in spans with data-word-index
    // This is tricky because we need to match TTS words to rendered text
    return wrapWordsInHtml(props.html, audio.wordTimings().length);
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
          class="bg-primary/20 pointer-events-none absolute rounded-md opacity-0"
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
          background-color: color-mix(in srgb, currentColor 15%, transparent);
        }
      `}</style>
    </div>
  );
}

/**
 * Wraps individual words in the HTML with span elements for highlighting.
 * Preserves HTML structure while adding data-word-index attributes.
 */
function wrapWordsInHtml(html: string, _totalWords: number): string {
  // Create a temporary container to parse HTML
  const template = document.createElement('template');
  template.innerHTML = html;

  let wordIndex = 0;

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim()) return;

      // Split text into words while preserving whitespace
      const parts = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          // Whitespace - keep as text
          fragment.appendChild(document.createTextNode(part));
        } else if (part) {
          // Word - wrap in span
          const span = document.createElement('span');
          span.setAttribute('data-word-index', String(wordIndex++));
          span.textContent = part;
          span.style.position = 'relative';
          fragment.appendChild(span);
        }
      }

      node.parentNode?.replaceChild(fragment, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip script, style, and other non-content elements
      const tagName = (node as Element).tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
        return;
      }

      // Process child nodes (iterate backwards to handle replacements)
      const children = Array.from(node.childNodes);
      for (const child of children) {
        processNode(child);
      }
    }
  }

  // Process all nodes in the template
  const content = template.content;
  const children = Array.from(content.childNodes);
  for (const child of children) {
    processNode(child);
  }

  // Get the modified HTML
  const wrapper = document.createElement('div');
  wrapper.appendChild(content.cloneNode(true));
  return wrapper.innerHTML;
}
