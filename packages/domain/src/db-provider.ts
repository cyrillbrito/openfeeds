import { DbProvider } from '@repo/db';
import { environment } from './environment';

// Create database provider in separate file to avoid circular dependency
export const dbProvider = new DbProvider({ dbPath: environment.dbPath });
