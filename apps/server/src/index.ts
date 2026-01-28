import { initDb } from '@repo/db';
import { initDomain } from '@repo/domain';
import { Elysia } from 'elysia';
import { setupBullBoard } from './bull-board';
import { environment } from './environment';
import { apiApp } from './setup-elysia';

// Initialize database and domain before any other code runs
initDb({ databaseUrl: environment.databaseUrl });
initDomain({
  redis: { host: environment.redisHost, port: environment.redisPort },
  posthogPublicKey: environment.posthogPublicKey,
  resendApiKey: environment.resendApiKey,
});

// Setup Bull Board dashboard (monitoring only, no workers)
const serverAdapter = setupBullBoard();

const app = new Elysia().use(serverAdapter.registerPlugin()).use(apiApp).listen(3001);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
