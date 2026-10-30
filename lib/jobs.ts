import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { appUrl, emailConfigured, layout, sendEmail } from "@/lib/email";
import { computeIndices, isAtRisk } from "@/lib/scoring";
import { isDue, SCHEDULE } from "@/lib/schedule";
import { formatWeekShort, recentWeeks, weekStartOf } from "@/lib/week";

type Org = typeof schema.organizations.$inferSelect;
export type JobOptions = { now?: Date; force?: boolean; dryRun?: boolean };
export type JobReport = {
  org: string;
  status: "sent" | "not_due" | "dry_run" | "email_not_configured";
  week: string;
  recipients: number;
  sent: number;
  failed: string[];
};

async function alreadySent(kind: "weekly_reminder" | "at_risk_digest", week: string, personIds: string[]) {
  if (!personIds.length) return new Set<string>();
  const rows = await db
    .select({ personId: schema.remindersLog.personId })
    .from(schema.remindersLog)
    .where(
      and(
        eq(schema.remindersLog.kind, kind),
        eq(schema.remindersLog.weekStart, week),
        inArray(schema.remindersLog.personId, personIds),
      ),
    );
  return new Set(rows.map((r) => r.personId));
}

async function deliver(
  kind: "weekly_reminder" | "at_risk_digest",
  week: string,
  messages: { personId: string; to: string; subject: string; html: string; text: string }[],
) {
  let sent = 0;
  const failed: string[] = [];
  for (const m of messages) {
    const r = await sendEmail(m);
    if (r.ok) {
      // The unique (person, week, kind) index makes a repeat run a no-op.
      await db
        .insert(schema.remindersLog)
        .values({ personId: m.personId, weekStart: week, kind })
        .onConflictDoNothing();
      sent++;
    } else {
      failed.push(`${m.to}: ${r.error}`);
    }
  }
  return { sent, failed };
}

async function forEachOrg(
  kind: keyof typeof SCHEDULE,
  opts: JobOptions,
  build: (org: Org, week: string) => Promise<{ personId: string; to: string; subject: string; html: string; text: string }[]>,
): Promise<JobReport[]> {
  const now = opts.now ?? new Date();
  const orgs = await db.select().from(schema.organizations);
  const reports: JobReport[] = [];
  for (const org of orgs) {
    const week = weekStartOf(now, org.timezone, org.weekStartDay);
    const base = { org: org.name, week, recipients: 0, sent: 0, failed: [] as string[] };
    if (!opts.force && !isDue(now, org.timezone, SCHEDULE[kind])) {
      reports.push({ ...base, status: "not_due" });
      continue;
    }
    const all = await build(org, week);
    const done = await alreadySent(kind, week, all.map((m) => m.personId));
    const messages = all.filter((m) => !done.has(m.personId));
    if (opts.dryRun) {
      reports.push({ ...base, status: "dry_run", recipients: messages.length });
    } else if (!emailConfigured()) {
      reports.push({ ...base, status: "email_not_configured", recipients: messages.length });
    } else {
      reports.push({ ...base, status: "sent", recipients: messages.length, ...(await deliver(kind, week, messages)) });
    }
  }
  return reports;
}

/** Emails every active (non-sample) person who hasn't checked in this week. */
export function runReminders(opts: JobOptions = {}) {
  return forEachOrg("weekly_reminder", opts, async (org, week) => {
    const { people, checkins } = schema;
    const rows = await db
      .select({ id: people.id, name: people.name, email: people.email, checkin: checkins.id })
      .from(people)
      .leftJoin(checkins, and(eq(checkins.personId, people.id), eq(checkins.weekStart, week)))
      .where(and(eq(people.orgId, org.id), eq(people.active, true), eq(people.isSample, false)));
    return rows
      .filter((r) => !r.checkin)
      .map((r) => {
        const { html, text } = layout({
          heading: `How was your week, ${r.name.split(" ")[0]}?`,
          paragraphs: [
            `Your weekly check-in for the week of ${formatWeekShort(week)} is ready. It’s five quick questions and takes about a minute.`,
            "Your manager and HR see your scores; any note you write stays private unless you choose to share it.",
          ],
          cta: { label: "Do my check-in", href: `${appUrl()}/check-in` },
        });
        return { personId: r.id, to: r.email, subject: "Your weekly check-in", html, text };
      });
  });
}

/**
 * Emails each manager their team's participation and how many reports are at risk.
 * Counts only: no names or individual scores in the email.
 */
export function runDigest(opts: JobOptions = {}) {
  return forEachOrg("at_risk_digest", opts, async (org, week) => {
    const { people, teams, checkins } = schema;
    const managed = await db
      .select({ teamId: teams.id, managerId: teams.managerId })
      .from(teams)
      .innerJoin(people, eq(people.id, teams.managerId))
      .where(and(eq(people.orgId, org.id), eq(people.active, true), eq(people.isSample, false), isNotNull(teams.managerId)));
    if (!managed.length) return [];

    const teamIds = managed.map((m) => m.teamId);
    const members = await db
      .select({ id: people.id, teamId: people.teamId })
      .from(people)
      .where(and(inArray(people.teamId, teamIds), eq(people.active, true)));
    const weeks = recentWeeks(week, 8);
    const memberIds = members.map((m) => m.id);
    const cks = memberIds.length
      ? await db
          .select()
          .from(checkins)
          .where(and(inArray(checkins.personId, memberIds), inArray(checkins.weekStart, weeks)))
      : [];
    const latest = new Map<string, (typeof cks)[number]>();
    for (const c of cks) {
      const prev = latest.get(c.personId);
      if (!prev || c.weekStart > prev.weekStart) latest.set(c.personId, c);
    }

    const managers = await db
      .select({ id: people.id, name: people.name, email: people.email })
      .from(people)
      .where(inArray(people.id, [...new Set(managed.map((m) => m.managerId!))]));

    return managers.flatMap((m) => {
      const myTeams = new Set(managed.filter((t) => t.managerId === m.id).map((t) => t.teamId));
      const reports = members.filter((p) => p.teamId && myTeams.has(p.teamId) && p.id !== m.id);
      if (!reports.length) return [];
      const checkedIn = reports.filter((p) => latest.get(p.id)?.weekStart === week).length;
      const atRisk = reports.filter((p) => {
        const c = latest.get(p.id);
        return c ? isAtRisk(computeIndices(c)) : false;
      }).length;
      const { html, text } = layout({
        heading: atRisk
          ? `${atRisk} ${atRisk === 1 ? "person on your team may" : "people on your team may"} need a check-in`
          : "Your team this week",
        paragraphs: [
          `${checkedIn} of ${reports.length} of your direct reports have checked in for the week of ${formatWeekShort(week)}.`,
          atRisk
            ? `${atRisk} ${atRisk === 1 ? "is" : "are"} showing high burnout or low happiness on their latest check-in. A quick 1:1 can help; details are on your dashboard.`
            : "Nobody is flagged for high burnout or low happiness right now.",
        ],
        cta: { label: "Open my dashboard", href: `${appUrl()}/dashboard${atRisk ? "?risk=1" : ""}` },
      });
      return [
        {
          personId: m.id,
          to: m.email,
          subject: atRisk ? `Steady: ${atRisk} on your team may need a check-in` : "Steady: your team this week",
          html,
          text,
        },
      ];
    });
  });
}
