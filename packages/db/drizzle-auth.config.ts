import { defineConfig } from 'drizzle-kit';
import { authDbConnection, initDb } from './src/config';

initDb({ dbPath: process.env.DB_PATH || '../../dbs' });

export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: authDbConnection(),
  schema: './src/schema/auth.ts',
  out: './drizzle-auth',
});
