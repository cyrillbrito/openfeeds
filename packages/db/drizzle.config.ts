import { defineConfig } from 'drizzle-kit';
import { DbProvider } from './src/db-provider';

const dbProvider = new DbProvider({
  dbPath: process.env.DB_PATH || '../../dbs',
});

export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: dbProvider.userDbConnection('_user-template'),
  schema: './src/schema/schema.ts',
});
