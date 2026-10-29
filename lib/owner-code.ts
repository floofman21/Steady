import { createHash, timingSafeEqual } from "node:crypto";

/** Codes shorter than this are ignored, so a weak value can't turn the feature on. */
export const OWNER_CODE_MIN_LENGTH = 16;

export function ownerCodeEnabled(configured = process.env.OWNER_ACCESS_CODE ?? "") {
  return configured.trim().length >= OWNER_CODE_MIN_LENGTH;
}

/** Constant-time comparison of a typed code against OWNER_ACCESS_CODE. */
export function ownerCodeMatches(input: string, configured = process.env.OWNER_ACCESS_CODE ?? "") {
  if (!ownerCodeEnabled(configured)) return false;
  const digest = (s: string) => createHash("sha256").update(s.trim()).digest();
  return timingSafeEqual(digest(input), digest(configured));
}
