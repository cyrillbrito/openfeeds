// Registering the router as the single-flight collector is what turns a
// mutation into ONE round trip: the action's response carries the refreshed
// `query()` data for the page the client will show, so the router seeds its
// cache from the envelope instead of refetching.
//
// Loaded before any dispatch via `serverFunctions.configure` in vite.config.ts.
import { configureServerFunctionsServer } from '@solidjs/web/server-functions/server';
import { createFlightDataCollector } from '@solidjs/router/server';

import { Router } from './router';

configureServerFunctionsServer({
  collectFlightData: createFlightDataCollector(Router),
});
