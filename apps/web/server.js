// The production server: static client assets, then the built server
// bundle's `handleRequest` — a web `Request -> Response` handler that streams
// the SSR render, resolves hashed assets through the build manifest, and
// serves the /_server endpoint.
//
// `Bun.serve` takes that handler directly, so there is no Node http <-> web
// adapter here. Run it with Bun (`bun run start`); under Node it exits.
import { handleRequest } from './dist/server/server.js';

const port = Number(process.env.PORT ?? 3000);
const clientDir = new URL('./dist/client/', import.meta.url);

Bun.serve({
  port,
  idleTimeout: 60,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname !== '/' && !pathname.includes('..')) {
      // Bun.file infers Content-Type from the extension and streams it.
      const asset = Bun.file(new URL(`.${pathname}`, clientDir));
      if (await asset.exists()) return new Response(asset);
    }

    return handleRequest(request);
  },
});

console.log(`Server running at http://localhost:${port}`);
