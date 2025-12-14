import { readFileSync } from 'fs';
import { createServer, type Server } from 'http';
import { join } from 'path';

export const MOCK_SERVER_PORT = 9999;
export const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;

// Load mock RSS feeds
const techBlogXML = readFileSync(join(__dirname, 'feeds/tech-blog.xml'), 'utf-8');
const newsFeedXML = readFileSync(join(__dirname, 'feeds/news-feed.xml'), 'utf-8');
const podcastFeedXML = readFileSync(join(__dirname, 'feeds/podcast-feed.xml'), 'utf-8');

let server: Server | null = null;

export function startMockServer() {
  if (server) {
    console.log(`[Mock Server] Already running on port ${MOCK_SERVER_PORT}`);
    return server;
  }

  server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${MOCK_SERVER_PORT}`);

    // Health check for Playwright webServer
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Mock RSS Server is running');
      return;
    }

    // Route: Tech Blog RSS
    if (url.pathname === '/tech-blog.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(techBlogXML);
      return;
    }

    // Route: News Feed RSS
    if (url.pathname === '/news-feed.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(newsFeedXML);
      return;
    }

    // Route: Podcast Feed RSS
    if (url.pathname === '/podcast-feed.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(podcastFeedXML);
      return;
    }

    // Route: Malformed/Invalid Feed (for error testing)
    if (url.pathname === '/invalid-feed.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end('This is not valid XML');
      return;
    }

    // Route: 404 Feed (for testing missing feeds)
    if (url.pathname === '/not-found.xml') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Feed not found');
      return;
    }

    // Default 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Mock RSS Server - Route not found: ${url.pathname}`);
  });

  server.listen(MOCK_SERVER_PORT, () => {
    console.log(`[Mock Server] Started on ${MOCK_SERVER_URL}`);
  });

  return server;
}

export function stopMockServer() {
  if (server) {
    server.close(() => {
      console.log('[Mock Server] Stopped');
    });
    server = null;
  }
}

// Export for global setup/teardown
export { server };
