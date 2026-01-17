import { detectFeedsFromPage } from "@/utils/feed-detector";
import type { DiscoveredFeed, MessageType } from "@/utils/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    // Listen for messages from popup
    browser.runtime.onMessage.addListener(
      (message: MessageType, _sender, sendResponse) => {
        if (message.type === "GET_FEEDS") {
          const feeds = detectFeedsFromPage();
          sendResponse({ type: "FEEDS_RESULT", feeds } as MessageType);
        }
        return true; // Keep channel open for async response
      }
    );
  },
});
