import { defineConfig } from 'drizzle-kit';
import { DbProvider } from './src/db-provider';

const dbProvider = new DbProvider({
  dbPath: process.env.DB_PATH || '../../dbs',
});

export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: dbProvider.authDbConnection(),
  schema: './src/schema/auth.ts',
  out: './drizzle-auth',
});
