// Netlify Scheduled Function: runs every hour (schedules are in UTC).
// Reminders go out Monday 09:00 and digests Thursday 09:00 in each organization's own
// time zone, so the routes check the local time on every call instead of using a fixed
// UTC hour (which would drift with daylight saving). reminders_log prevents duplicates.
export default async function steadyJobs() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[steady-jobs] URL or CRON_SECRET is not set; skipping.");
    return;
  }
  for (const path of ["/api/cron/reminders", "/api/cron/digest"]) {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${secret}` } });
    console.log(`[steady-jobs] ${path} → ${res.status} ${await res.text()}`);
  }
}

export const config = { schedule: "@hourly" };
