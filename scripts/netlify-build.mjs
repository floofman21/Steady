// Netlify build: on production deploys, apply database migrations, then build.
// Deploy previews skip migrations so an unmerged change can't alter the production schema.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.CONTEXT === "production") {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Add your Neon connection string under Project configuration → " +
        "Environment variables (scope: Builds and Functions), then redeploy.",
    );
    process.exit(1);
  }
  run("pnpm drizzle-kit migrate");
} else {
  console.log(`Skipping migrations (CONTEXT=${process.env.CONTEXT ?? "unset"}).`);
}
run("pnpm next build");
