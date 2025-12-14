import PlayIcon from 'lucide-solid/icons/play';
import { createSignal } from 'solid-js';
import { extractYouTubeVideoId, getYouTubeEmbedUrl, isYouTubeShorts } from '../utils/youtube';

interface YouTubeEmbedProps {
  url: string;
  title?: string;
  class?: string;
}

export function YouTubeEmbed(props: YouTubeEmbedProps) {
  const [showPlayer, setShowPlayer] = createSignal(false);

  const videoId = () => extractYouTubeVideoId(props.url);
  const embedUrl = () => {
    const id = videoId()!;
    return getYouTubeEmbedUrl(id, isShorts());
  };
  const isShorts = () => isYouTubeShorts(props.url);

  if (!videoId()) {
    return null;
  }

  const containerClass = isShorts() ? 'w-full max-w-[315px] mx-auto' : 'w-full aspect-video';

  const iframeClass = isShorts() ? 'w-[315px] h-[560px]' : 'w-full h-full';

  return (
    <div class={`youtube-embed ${props.class || ''}`}>
      {!showPlayer() ? (
        <div
          class={`group relative cursor-pointer overflow-hidden rounded-lg bg-black ${containerClass}`}
          onClick={() => setShowPlayer(true)}
        >
          <img
            src={`https://img.youtube.com/vi/${videoId()}/maxresdefault.jpg`}
            alt={props.title || 'YouTube Video'}
            class={
              isShorts() ? 'h-[560px] w-full object-cover' : 'aspect-video w-full object-cover'
            }
            onError={(e) => {
              // Fallback to medium quality thumbnail if maxres doesn't exist
              (e.currentTarget as HTMLImageElement).src =
                `https://img.youtube.com/vi/${videoId()}/hqdefault.jpg`;
            }}
          />
          <div class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
            <div class="rounded-full bg-red-600 p-4 transition-colors hover:bg-red-700">
              <PlayIcon size={24} class="ml-1 text-white" />
            </div>
          </div>
          <div class="absolute right-2 bottom-2 rounded bg-black/80 px-2 py-1 text-xs text-white">
            {isShorts() ? 'YouTube Shorts' : 'YouTube'}
          </div>
        </div>
      ) : (
        <div class={`overflow-hidden rounded-lg ${containerClass}`}>
          <iframe
            src={embedUrl()}
            title={props.title || 'YouTube Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            class={iframeClass}
          ></iframe>
        </div>
      )}
    </div>
  );
}
