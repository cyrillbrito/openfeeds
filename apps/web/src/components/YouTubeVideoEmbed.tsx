import { Play } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';
import { extractYouTubeVideoId } from '~/utils/youtube';

interface YouTubeVideoEmbedProps {
  url: string;
  title?: string;
  class?: string;
  onPlay?: () => void;
}

export function YouTubeVideoEmbed(props: YouTubeVideoEmbedProps) {
  const [showPlayer, setShowPlayer] = createSignal(false);

  const videoId = () => extractYouTubeVideoId(props.url);
  const embedUrl = () => {
    const id = videoId()!;
    return `https://www.youtube.com/embed/${id}?autoplay=1`;
  };

  return (
    <Show when={videoId()}>
      <div class={twMerge('youtube-video-embed rounded-lg bg-black', props.class)}>
        <Show
          when={showPlayer()}
          fallback={
            <div
              class="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-lg bg-black"
              onClick={() => {
                setShowPlayer(true);
                props.onPlay?.();
              }}
            >
              <img
                src={`https://img.youtube.com/vi/${videoId()}/mqdefault.jpg`}
                alt={props.title || 'YouTube Video'}
                class="aspect-video w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    `https://img.youtube.com/vi/${videoId()}/hqdefault.jpg`;
                }}
              />
              <div class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                <div class="rounded-full bg-red-600 p-3 transition-all duration-200 hover:scale-110 hover:bg-red-700 sm:p-4">
                  <Play size={24} class="ml-0.5 h-6 w-6 text-white sm:h-8 sm:w-8" />
                </div>
              </div>
              <div class="absolute right-2 bottom-2 rounded bg-black/80 px-2 py-1 text-xs font-medium text-white">
                YouTube
              </div>
            </div>
          }
        >
          <div class="aspect-video overflow-hidden rounded-lg shadow-sm">
            <iframe
              src={embedUrl()}
              title={props.title || 'YouTube Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              class="h-full w-full border-0"
            ></iframe>
          </div>
        </Show>
      </div>
    </Show>
  );
}
