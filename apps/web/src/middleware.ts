// The server middleware chain (wired via `start.middleware` in
// vite.config.ts): fetch-style functions fronting every request the server
// dispatches — page renders, server function calls, and API routes alike.
// Each runs inside the request-event scope, so getRequestEvent() (and the
// session helpers built on it) work here exactly as in application code.
import { createAPIHandler } from 'filesystem-routing/api';
import routes from 'virtual:file-routes';

import { startFeedCron } from './server/cron';

// This module is evaluated once when the server boots — dev middleware and
// production handler alike — which makes it the app's server lifecycle hook.
// The feed sweep starts here rather than in server.js so that `bun run dev`
// fetches feeds too. startFeedCron() is idempotent (see server/cron.ts).
startFeedCron();

// createAPIHandler serves the GET/POST/... exports of route modules
// (see src/routes/api) and passes everything else down the chain.
export default [createAPIHandler(routes)];
