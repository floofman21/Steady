// Copies drizzle-kit's SQL migrations into netlify/database/migrations, the folder
// Netlify Database applies automatically before each deploy goes live.
// Runs after `pnpm db:generate`. Existing files are never rewritten.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const from = "drizzle";
const to = join("netlify", "database", "migrations");
mkdirSync(to, { recursive: true });

for (const file of readdirSync(from).filter((f) => f.endsWith(".sql")).sort()) {
  const target = join(to, file);
  if (!existsSync(target)) {
    copyFileSync(join(from, file), target);
    console.log(`Added ${target}`);
  } else if (readFileSync(target, "utf8") !== readFileSync(join(from, file), "utf8")) {
    console.error(`${target} differs from ${join(from, file)}. Applied migrations must never change.`);
    process.exitCode = 1;
  }
}
