import { getArticleAudioBuffer } from '@repo/domain';
import { createFileRoute } from '@tanstack/solid-router';
import { auth } from '~/server/auth';

export const Route = createFileRoute('/api/articles/$articleId/audio')({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { articleId: string } }) => {
        const session = await auth.api.getSession({ headers: request.headers });
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
