// Netlify build: on production deploys, apply database migrations, then build.
// Deploy previews skip migrations so an unmerged change can't alter the production schema.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.CONTEXT === "production") {
  const missing = {
    DATABASE_URL: "your Neon connection string",
    AUTH_SECRET: "a random secret (run `openssl rand -base64 32`)",
  };
  for (const [name, what] of Object.entries(missing)) {
    if (!process.env[name]) {
      console.error(
        `${name} is not set. Add ${what} under Project configuration → Environment variables ` +
          "(scopes: Builds and Functions), then redeploy.",
      );
      process.exit(1);
    }
  }
  run("pnpm drizzle-kit migrate");
} else {
  console.log(`Skipping migrations (CONTEXT=${process.env.CONTEXT ?? "unset"}).`);
}
run("pnpm next build");
