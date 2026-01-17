import { Elysia } from 'elysia';
import { setupBullBoard } from './bull-board';
import { apiApp } from './setup-elysia';

// Setup Bull Board dashboard (monitoring only, no workers)
const serverAdapter = setupBullBoard();

const app = new Elysia().use(serverAdapter.registerPlugin()).use(apiApp).listen(3001);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
