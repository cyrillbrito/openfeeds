import { Title } from '@solidjs/meta';
import type { RouteDefinition } from '@solidjs/router';
import { httpStatus } from '@solidjs/web';

import { Button } from '../components/ui/button';
import { paths } from '../router';

// httpStatus() sets the response status during SSR (a no-op in the
// browser); it runs in preload, before the response head flushes.
export const route = {
  preload: () => httpStatus(404),
} satisfies RouteDefinition;

export default function NotFound() {
  return (
    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-24 text-center">
      <Title>Not found — OpenFeeds</Title>
      <h1 class="text-lg font-semibold">Page not found</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        That page does not exist.
      </p>
      <Button as="a" href={paths()} size="sm" class="mt-6">
        Back to inbox
      </Button>
    </div>
  );
}
