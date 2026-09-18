// drizzle-kit config — used only at development time to turn schema.ts into
// SQL migrations (`bun run db:generate`). The app itself never reads this:
// it applies the generated files at boot (see src/server/db/index.ts).
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
});
