import { useEffect, useState } from 'react';

/**
 * YouTube video thumbnail with progressive resolution upgrade.
 *
 * YouTube thumbnail URLs are predictable (`img.youtube.com/vi/{id}/{size}.jpg`)
 * but not all resolutions exist for every video. Only `hqdefault` (480x360)
 * and below are guaranteed. `sddefault` and `maxresdefault` depend on the
 * video's upload quality and age.
 *
 * The tricky part: YouTube returns a valid 120x90 placeholder JPEG on 404
 * responses, so the browser treats it as a successful image load and `onerror`
 * never fires. We detect this by checking `naturalWidth`/`naturalHeight` on
 * the loaded probe image.
 *
 * Strategy (from paulirish/lite-youtube-embed):
 * 1. Render `hqdefault.jpg` with `loading="lazy"` (always available)
 * 2. On mount, probe `maxresdefault.jpg` with `new Image()`
 * 3. If the probe loads with real dimensions (not the 120x90 placeholder),
 *    upgrade the displayed `src`
 *
 * @see https://github.com/paulirish/lite-youtube-embed/blob/master/youtube-thumbnail-urls.md
 * @see https://github.com/paulirish/lite-youtube-embed/blob/master/src/lite-yt-embed.js — `upgradePosterImage()`
 */

/** YouTube's 404 placeholder image dimensions */
const YT_PLACEHOLDER_WIDTH = 120;
const YT_PLACEHOLDER_HEIGHT = 90;

interface YouTubeThumbnailProps {
  videoId: string;
  alt: string;
}

export function YouTubeThumbnail({ videoId, alt }: YouTubeThumbnailProps) {
  const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const maxResUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const [src, setSrc] = useState(hqUrl);

  useEffect(() => {
    const timer = setTimeout(() => {
      const probe = new Image();
      probe.fetchPriority = 'low';
      probe.src = maxResUrl;
      probe.addEventListener('load', () => {
        const isPlaceholder =
          probe.naturalWidth === YT_PLACEHOLDER_WIDTH &&
          probe.naturalHeight === YT_PLACEHOLDER_HEIGHT;

        if (!isPlaceholder) {
          setSrc(probe.src);
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [videoId]);

  return (
    <div className="mb-2 w-full overflow-hidden rounded-lg md:max-w-2xl">
      <div className="aspect-video w-full">
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      </div>
    </div>
  );
}
