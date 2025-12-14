export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Handle youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;

      // Handle youtube.com/shorts/VIDEO_ID
      const shortsMatch = urlObj.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shortsMatch) return shortsMatch[1];

      // Handle youtube.com/embed/VIDEO_ID
      const embedMatch = urlObj.pathname.match(/^\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];

      // Handle youtube.com/v/VIDEO_ID
      const vMatch = urlObj.pathname.match(/^\/v\/([^/?]+)/);
      if (vMatch) return vMatch[1];
    }

    // Handle youtu.be/VIDEO_ID
    if (urlObj.hostname.includes('youtu.be')) {
      const videoId = urlObj.pathname.slice(1).split('/')[0];
      if (videoId) return videoId;
    }

    return null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(videoId: string, isShorts = false): string {
  const baseUrl = `https://www.youtube.com/embed/${videoId}`;
  if (isShorts) {
    return `${baseUrl}?autoplay=1`;
  }
  return baseUrl;
}

export function isYouTubeShorts(url: string): boolean {
  console.log(url);
  if (!url) return false;

  try {
    const urlObj = new URL(url);

    return urlObj.hostname.includes('youtube.com') && urlObj.pathname.includes('/shorts/');
  } catch {
    return false;
  }
}

export function isYouTubeFeed(feedUrl: string): boolean {
  if (!feedUrl) return false;

  try {
    const urlObj = new URL(feedUrl);
    return urlObj.hostname.includes('youtube.com') && feedUrl.includes('feeds/videos.xml');
  } catch {
    return false;
  }
}
