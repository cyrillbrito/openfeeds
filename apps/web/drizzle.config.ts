// drizzle-kit config — used only at development time to turn schema.ts into
// SQL migrations (`bun run db:generate`). The app itself never reads this:
// it applies the generated files at boot (see src/server/db/index.ts).
//
// Pass a name:  bun run db:generate --name add_subscriptions
// Without one, drizzle-kit generates a random name.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  // Only `db:studio` and `db:push` connect; `db:generate` diffs the schema
  // file against the migration folder and needs no database at all.
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://openfeeds:openfeeds@localhost:5432/openfeeds',
  },
});
