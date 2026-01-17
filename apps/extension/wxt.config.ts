import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "OpenFeeds",
    description: "Discover and follow RSS feeds from any website",
    permissions: ["activeTab", "storage"],
    host_permissions: ["http://localhost:3001/*", "https://*.openfeeds.com/*"],
  },
  webExt: {
    startUrls: ["https://example.com"],
  },
});
