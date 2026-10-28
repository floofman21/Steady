import { getConnectionString } from "@netlify/database";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** DATABASE_URL wins; on Netlify, Netlify Database provides NETLIFY_DB_URL. */
function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    return getConnectionString();
  } catch {
    throw new Error("No database configured: set DATABASE_URL, or add Netlify Database to the project.");
  }
}

// Created on first query, not at import, so builds don't need database access.
// Reused across hot reloads in dev. `prepare: false` keeps it safe behind a pooler.
const globalForDb = globalThis as unknown as { steadyDb?: Db };

function getDb(): Db {
  if (!globalForDb.steadyDb) {
    const client = postgres(connectionString(), { prepare: false, max: 5 });
    globalForDb.steadyDb = drizzle(client, { schema });
  }
  return globalForDb.steadyDb;
}

export const db = new Proxy({} as Db, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
});
export { schema };
