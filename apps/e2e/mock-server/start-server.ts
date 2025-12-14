import { startMockServer } from './server';

// Start the mock server and keep it running
startMockServer();

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[Mock Server] Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Mock Server] Received SIGINT, shutting down...');
  process.exit(0);
});
