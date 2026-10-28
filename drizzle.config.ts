import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit is for local work: `generate` writes to ./drizzle (with its diff
// snapshots), and scripts/sync-netlify-migrations.mjs copies the SQL into
// netlify/database/migrations, which Netlify applies on every deploy.
// Never run `migrate` against a Netlify-hosted database.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
