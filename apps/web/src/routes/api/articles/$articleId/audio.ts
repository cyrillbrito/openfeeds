import { createFileRoute } from '@tanstack/solid-router';
import { z } from 'zod';
import type { AuthContext } from '~/server/middleware/auth';
import { authRequestMiddleware } from '~/server/middleware/auth';

/**
 * Streaming endpoint for audio files.
 *
 * This is intentionally a separate file-based route rather than a server function because:
 * 1. Audio files can be large (several MB) and need HTTP streaming capabilities
 * 2. Supports byte-range requests for progressive loading and seeking
 * 3. Enables proper browser caching with HTTP cache headers
 * 4. Avoids memory issues from loading entire files into strings (base64 encoding would add 33% overhead)
 *
 * Server functions are great for data operations, but streaming binary files
 * requires a proper HTTP response with streaming capabilities.
 */
export const Route = createFileRoute('/api/articles/$articleId/audio')({
  server: {
    middleware: [authRequestMiddleware],
    handlers: {
      GET: async ({ params, context }) => {
        const { user } = context as unknown as AuthContext;

        const { articleId } = params;
        // Article IDs are uuidv7. Validate at the route boundary so malformed
        // input (including `..%2F..` path-traversal payloads) fails fast with
        // 400 instead of reaching the filesystem layer. Domain-side validation
        // in `tts.ts` is the authoritative guard; this is fail-fast at the boundary.
        if (!z.uuidv7().safeParse(articleId).success) {
          return Response.json({ message: 'Invalid article id' }, { status: 400 });
        }

        // Dynamic imports to keep server-only modules out of the client bundle.
        // See: https://github.com/TanStack/router/issues/2783
        const { getArticleAudioBuffer } = await import('@repo/domain');

        const audioBuffer = await getArticleAudioBuffer(user.id, articleId);

        if (!audioBuffer) {
          return Response.json({ message: 'Audio not found' }, { status: 404 });
        }

        // Convert Buffer to Uint8Array for Response compatibility
        const uint8Array = new Uint8Array(audioBuffer);

        return new Response(uint8Array, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length.toString(),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      },
    },
  },
});
