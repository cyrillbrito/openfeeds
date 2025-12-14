import { runAllMigrations } from '@repo/db';
import { dbProvider } from '@repo/domain';
import { Elysia } from 'elysia';
import { setupBullBoard } from './bull-board';
import { apiApp } from './setup-elysia';

// Run migrations on startup
await runAllMigrations(dbProvider);

// Setup Bull Board dashboard (monitoring only, no workers)
const serverAdapter = setupBullBoard();

const app = new Elysia().use(serverAdapter.registerPlugin()).use(apiApp).listen(3001);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
