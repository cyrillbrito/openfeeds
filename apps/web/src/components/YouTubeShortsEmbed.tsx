import { twMerge } from 'tailwind-merge';
import { extractYouTubeVideoId } from '~/utils/youtube';

interface YouTubeShortsEmbedProps {
  url: string;
  title?: string;
  autoplay?: boolean;
  className?: string;
}

export function YouTubeShortsEmbed({ url, title, autoplay, className }: YouTubeShortsEmbedProps) {
  const videoId = extractYouTubeVideoId(url);
  const embedUrl = videoId
    ? autoplay
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
      : `https://www.youtube.com/embed/${videoId}`
    : undefined;

  return (
    <iframe
      src={embedUrl}
      title={title || 'YouTube Shorts'}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      className={twMerge('aspect-9/16', className)}
    />
  );
}
