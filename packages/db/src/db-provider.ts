import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as authSchema from './schema/auth';
import * as schema from './schema/schema';

export interface DbProviderConfig {
  dbPath: string;
}

export class DbProvider {
  constructor(private config: DbProviderConfig) {}

  authDbConnection() {
    return {
      url: `${this.config.dbPath}/_auth.db`,
    };
  }

  authDb() {
    const client = new Database(`${this.config.dbPath}/_auth.db`);
    return drizzle({
      client,
      schema: authSchema,
    });
  }

  userDbConnection(userId: string) {
    return {
      url: `${this.config.dbPath}/${userId}.db`,
    };
  }

  userDb(userId: string) {
    const client = new Database(`${this.config.dbPath}/${userId}.db`);
    return drizzle({
      client,
      schema,
    });
  }
}

export type UserDb = ReturnType<DbProvider['userDb']>;
