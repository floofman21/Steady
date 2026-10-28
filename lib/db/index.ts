import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Created on first query, not at import, so builds don't need database access.
// Reused across hot reloads in dev. `prepare: false` keeps it safe behind Neon's pooler.
const globalForDb = globalThis as unknown as { steadyDb?: Db };

export function getDb(): Db {
  if (!globalForDb.steadyDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    globalForDb.steadyDb = drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
  }
  return globalForDb.steadyDb;
}

export const db = new Proxy({} as Db, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
});
export { schema };
