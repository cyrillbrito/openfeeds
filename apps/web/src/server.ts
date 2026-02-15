import handler, { createServerEntry } from '@tanstack/solid-start/server-entry';

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
