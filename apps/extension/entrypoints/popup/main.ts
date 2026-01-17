import type { DiscoveredFeed, MessageType } from "@/utils/types";

const loadingEl = document.getElementById("loading")!;
const noFeedsEl = document.getElementById("no-feeds")!;
const feedsListEl = document.getElementById("feeds-list")!;
const feedsEl = document.getElementById("feeds")!;
const feedsCountEl = document.querySelector(".feeds-count")!;
const errorEl = document.getElementById("error")!;
const errorMessageEl = document.querySelector(".error-message")!;

function showState(state: "loading" | "no-feeds" | "feeds-list" | "error") {
  loadingEl.classList.toggle("hidden", state !== "loading");
  noFeedsEl.classList.toggle("hidden", state !== "no-feeds");
  feedsListEl.classList.toggle("hidden", state !== "feeds-list");
  errorEl.classList.toggle("hidden", state !== "error");
}

function createFeedItem(feed: DiscoveredFeed): HTMLLIElement {
  const li = document.createElement("li");

  const infoDiv = document.createElement("div");
  infoDiv.className = "feed-info";

  const titleDiv = document.createElement("div");
  titleDiv.className = "feed-title";
  titleDiv.textContent = feed.title;
  titleDiv.title = feed.url;

  const typeDiv = document.createElement("div");
  typeDiv.className = "feed-type";
  typeDiv.textContent = formatFeedType(feed.type);

  infoDiv.appendChild(titleDiv);
  infoDiv.appendChild(typeDiv);

  const button = document.createElement("button");
  button.className = "follow-btn";
  button.textContent = "Follow";
  button.addEventListener("click", () => handleFollow(feed, button));

  li.appendChild(infoDiv);
  li.appendChild(button);

  return li;
}

function formatFeedType(type: string | undefined): string {
  if (!type || type === "potential") return "Feed";
  if (type.includes("rss")) return "RSS";
  if (type.includes("atom")) return "Atom";
  if (type.includes("json")) return "JSON Feed";
  return "Feed";
}

async function handleFollow(
  feed: DiscoveredFeed,
  button: HTMLButtonElement
): Promise<void> {
  button.disabled = true;
  button.textContent = "Adding...";

  try {
    const response = (await browser.runtime.sendMessage({
      type: "FOLLOW_FEED",
      feed,
    } as MessageType)) as { type: "FOLLOW_RESULT"; success: boolean; error?: string };

    if (response.success) {
      button.textContent = "Added!";
      button.classList.add("success");
    } else {
      button.textContent = "Failed";
      button.classList.add("error");
      button.title = response.error || "Unknown error";

      // Reset button after delay
      setTimeout(() => {
        button.textContent = "Follow";
        button.classList.remove("error");
        button.disabled = false;
        button.title = "";
      }, 2000);
    }
  } catch (error) {
    console.error("Failed to follow feed:", error);
    button.textContent = "Error";
    button.classList.add("error");
    button.disabled = false;
  }
}

async function init(): Promise<void> {
  showState("loading");

  try {
    // Get the active tab
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      showState("error");
      errorMessageEl.textContent = "Could not access current tab";
      return;
    }

    // Request feeds from content script
    const response = (await browser.tabs.sendMessage(tab.id, {
      type: "GET_FEEDS",
    } as MessageType)) as { type: "FEEDS_RESULT"; feeds: DiscoveredFeed[] };

    const feeds = response?.feeds || [];

    if (feeds.length === 0) {
      showState("no-feeds");
      return;
    }

    // Display feeds
    feedsCountEl.textContent = `Found ${feeds.length} feed${feeds.length === 1 ? "" : "s"}`;
    feedsEl.innerHTML = "";

    for (const feed of feeds) {
      feedsEl.appendChild(createFeedItem(feed));
    }

    showState("feeds-list");
  } catch (error) {
    console.error("Failed to detect feeds:", error);
    showState("error");
    errorMessageEl.textContent =
      "Could not detect feeds. Try refreshing the page.";
  }
}

// Initialize when popup opens
init();
