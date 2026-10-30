// When the weekly jobs run, in each organization's own time zone. Pure; unit-tested.

/** Monday 09:xx for reminders, Thursday 09:xx for digests, in the org's own time zone. */
export const SCHEDULE = {
  weekly_reminder: { weekday: 1, hour: 9 },
  at_risk_digest: { weekday: 4, hour: 9 },
} as const;

export function isDue(now: Date, timeZone: string, when: { weekday: number; hour: number }) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")!.value);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return weekday === when.weekday && hour === when.hour;
}
