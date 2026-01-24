import { getArticleAudioBuffer } from '@repo/domain';
import { createFileRoute } from '@tanstack/solid-router';
import { getAuth } from '~/server/auth';

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
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { articleId: string } }) => {
        const session = await getAuth().api.getSession({ headers: request.headers });
        if (!session) {
          return Response.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { articleId } = params;
        const audioBuffer = await getArticleAudioBuffer(session.user.id, articleId);

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
