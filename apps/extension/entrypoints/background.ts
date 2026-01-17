import type { DiscoveredFeed, MessageType, StorageData } from "@/utils/types";
import { DEFAULT_API_URL } from "@/utils/types";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: MessageType, _sender, sendResponse) => {
      if (message.type === "FOLLOW_FEED") {
        handleFollowFeed(message.feed).then(sendResponse);
        return true; // Keep channel open for async response
      }
    }
  );
});

async function getApiUrl(): Promise<string> {
  const result = await browser.storage.local.get("apiUrl");
  return (result as StorageData).apiUrl || DEFAULT_API_URL;
}

async function handleFollowFeed(
  feed: DiscoveredFeed
): Promise<{ type: "FOLLOW_RESULT"; success: boolean; error?: string }> {
  try {
    const apiUrl = await getApiUrl();

    const response = await fetch(`${apiUrl}/api/feeds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Send cookies for auth
      body: JSON.stringify({ url: feed.url }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || `Failed to follow feed (${response.status})`;

      if (response.status === 401) {
        return {
          type: "FOLLOW_RESULT",
          success: false,
          error: "Please log in to OpenFeeds first",
        };
      }

      if (response.status === 409) {
        return {
          type: "FOLLOW_RESULT",
          success: false,
          error: "You're already following this feed",
        };
      }

      return {
        type: "FOLLOW_RESULT",
        success: false,
        error: errorMessage,
      };
    }

    return { type: "FOLLOW_RESULT", success: true };
  } catch (error) {
    console.error("Failed to follow feed:", error);
    return {
      type: "FOLLOW_RESULT",
      success: false,
      error: "Network error - is OpenFeeds running?",
    };
  }
}
