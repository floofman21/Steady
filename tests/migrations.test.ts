import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Netlify only applies migrations from netlify/database/migrations; they must match drizzle-kit's output.
describe("Netlify migrations", () => {
  it("mirror every drizzle-kit migration exactly", () => {
    const sql = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const drizzle = sql("drizzle");
    expect(sql("netlify/database/migrations")).toEqual(drizzle);
    for (const f of drizzle) {
      expect(readFileSync(`netlify/database/migrations/${f}`, "utf8")).toBe(readFileSync(`drizzle/${f}`, "utf8"));
    }
  });
});
