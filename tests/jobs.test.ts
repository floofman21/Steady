import { describe, expect, it } from "vitest";
import { cronAuthorized } from "@/lib/cron-auth";
import { isDue, SCHEDULE } from "@/lib/schedule";

describe("isDue", () => {
  const NY = "America/New_York";
  it("is due during 09:00–09:59 on Monday in the org's time zone (reminders)", () => {
    expect(isDue(new Date("2026-11-02T14:00:00Z"), NY, SCHEDULE.weekly_reminder)).toBe(true); // Mon 09:00 EST
    expect(isDue(new Date("2026-11-02T14:59:00Z"), NY, SCHEDULE.weekly_reminder)).toBe(true);
    expect(isDue(new Date("2026-11-02T15:00:00Z"), NY, SCHEDULE.weekly_reminder)).toBe(false); // 10:00
    expect(isDue(new Date("2026-11-02T09:00:00Z"), NY, SCHEDULE.weekly_reminder)).toBe(false); // 04:00 local
  });
  it("follows daylight saving: 09:00 EDT is 13:00 UTC", () => {
    expect(isDue(new Date("2026-10-26T13:30:00Z"), NY, SCHEDULE.weekly_reminder)).toBe(true);
  });
  it("is due Thursday 09:xx for digests, not Monday", () => {
    expect(isDue(new Date("2026-10-29T13:05:00Z"), NY, SCHEDULE.at_risk_digest)).toBe(true);
    expect(isDue(new Date("2026-10-26T13:05:00Z"), NY, SCHEDULE.at_risk_digest)).toBe(false);
  });
  it("uses the local weekday across the date line", () => {
    // Sunday 22:30 UTC is Monday 09:30 in Sydney (AEDT, UTC+11).
    expect(isDue(new Date("2026-11-01T22:30:00Z"), "Australia/Sydney", SCHEDULE.weekly_reminder)).toBe(true);
  });
});

describe("cronAuthorized", () => {
  const req = (auth?: string) => new Request("https://x/api/cron/reminders", { headers: auth ? { authorization: auth } : {} });
  it("requires the exact bearer secret", () => {
    expect(cronAuthorized(req("Bearer s3cret-value"), "s3cret-value")).toBe(true);
    expect(cronAuthorized(req("Bearer wrong"), "s3cret-value")).toBe(false);
    expect(cronAuthorized(req(), "s3cret-value")).toBe(false);
  });
  it("rejects everything when CRON_SECRET is unset", () => {
    expect(cronAuthorized(req("Bearer "), "")).toBe(false);
  });
});
