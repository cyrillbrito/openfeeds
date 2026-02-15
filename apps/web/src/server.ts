import handler, { createServerEntry } from '@tanstack/solid-start/server-entry';
import { withDevCors } from './server/dev-cors';
import { handleWellKnown } from './server/well-known';

export default createServerEntry({
  fetch: withDevCors((request) => {
    // TanStack Start can't handle .well-known file paths, so we intercept them here.
    if (request.url.includes('/.well-known/')) {
      return handleWellKnown(request);
    }

    return handler.fetch(request);
  }),
});
