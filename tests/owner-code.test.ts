import { describe, expect, it } from "vitest";
import { ownerCodeEnabled, ownerCodeMatches } from "@/lib/owner-code";

const CODE = "correct-horse-battery-staple-42";

describe("owner access code", () => {
  it("is off when unset or shorter than 16 characters", () => {
    expect(ownerCodeEnabled("")).toBe(false);
    expect(ownerCodeEnabled("short-code")).toBe(false);
    expect(ownerCodeMatches("short-code", "short-code")).toBe(false);
    expect(ownerCodeEnabled(CODE)).toBe(true);
  });
  it("matches only the exact code (ignoring surrounding spaces)", () => {
    expect(ownerCodeMatches(CODE, CODE)).toBe(true);
    expect(ownerCodeMatches(` ${CODE} `, CODE)).toBe(true);
    expect(ownerCodeMatches(CODE.toUpperCase(), CODE)).toBe(false);
    expect(ownerCodeMatches("", CODE)).toBe(false);
  });
});
