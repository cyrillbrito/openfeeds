import { defineConfig } from 'drizzle-kit';
import { initDb, userDbConnection } from './src/config';

initDb({ dbPath: process.env.DB_PATH || '../../dbs' });

export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: userDbConnection('_user-template'),
  schema: './src/schema/schema.ts',
});
