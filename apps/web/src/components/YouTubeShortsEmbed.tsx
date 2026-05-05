import { twMerge } from 'tailwind-merge';
import { extractYouTubeVideoId } from '~/utils/youtube';

interface YouTubeShortsEmbedProps {
  url: string;
  title?: string;
  autoplay?: boolean;
  class?: string;
}

export function YouTubeShortsEmbed(props: YouTubeShortsEmbedProps) {
  const videoId = () => extractYouTubeVideoId(props.url);
  const embedUrl = () => {
    const id = videoId()!;
    const baseUrl = `https://www.youtube.com/embed/${id}`;
    return props.autoplay ? `${baseUrl}?autoplay=1` : baseUrl;
  };

  // No Show wrapper — keeping the iframe always mounted avoids a remount if
  // videoId() ever goes briefly falsy during a transition.
  return (
    <iframe
      src={embedUrl()}
      title={props.title || 'YouTube Shorts'}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      class={twMerge('aspect-9/16', props.class)}
    />
  );
}
