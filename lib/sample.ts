// Inserts or removes the sample org data. Shared by scripts/seed.ts and the HR admin
// "Load sample data" action. Everything inserted here is flagged is_sample.
import { and, eq, inArray } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { schema } from "@/lib/db";
import { generateSamplePeople, SAMPLE_DEPARTMENTS, SAMPLE_WEEKS } from "@/lib/sample-data";
import { addDays, recentWeeks, weekStartOf } from "@/lib/week";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any drizzle pg transaction
type Tx = PgTransaction<any, typeof schema, any>;

type InsertOptions = {
  orgId: string;
  timezone: string;
  now?: Date;
  emailDomain?: string;
  /** Prefix for employee codes; the seed keeps the prototype's EMP-, the app uses SMP-. */
  codePrefix?: string;
  /** Make the first HR person an hr_admin (seed only; in the app the real HR admin already exists). */
  withHrAdmin?: boolean;
};

export async function insertSampleData(tx: Tx, opts: InsertOptions) {
  const now = opts.now ?? new Date();
  // The sample's last week is the current week, so "this week" has data.
  const weeks = recentWeeks(weekStartOf(now, opts.timezone), SAMPLE_WEEKS);
  const sample = generateSamplePeople(opts.emailDomain ?? "example.com");
  const prefix = opts.codePrefix ?? "SMP-";

  const teamIds = new Map<string, string>();
  for (const [deptName, def] of Object.entries(SAMPLE_DEPARTMENTS)) {
    const [dept] = await tx
      .insert(schema.departments)
      .values({ orgId: opts.orgId, name: deptName, isSample: true })
      .returning();
    for (const teamName of def.teams) {
      const [team] = await tx.insert(schema.teams).values({ departmentId: dept.id, name: teamName }).returning();
      teamIds.set(teamName, team.id);
    }
  }

  // The first person listed on each team manages it.
  const managerOf = new Map<string, number>();
  for (const p of sample) if (!managerOf.has(p.team)) managerOf.set(p.team, p.index);
  const hrAdminIndex = opts.withHrAdmin ? sample.find((p) => p.dept === "HR")!.index : -1;

  const inserted = await tx
    .insert(schema.people)
    .values(
      sample.map((p) => ({
        orgId: opts.orgId,
        teamId: teamIds.get(p.team)!,
        employeeCode: p.employeeCode.replace(/^EMP-/, prefix),
        name: p.name,
        email: p.email,
        isSample: true,
        role:
          p.index === hrAdminIndex
            ? ("hr_admin" as const)
            : managerOf.get(p.team) === p.index
              ? ("manager" as const)
              : ("employee" as const),
      })),
    )
    .returning({ id: schema.people.id, name: schema.people.name });
  const idByName = new Map(inserted.map((r) => [r.name, r.id]));
  const personId = (index: number) => idByName.get(sample[index].name)!;

  for (const [teamName, index] of managerOf) {
    await tx
      .update(schema.teams)
      .set({ managerId: personId(index) })
      .where(eq(schema.teams.id, teamIds.get(teamName)!));
  }

  const rows = sample.flatMap((p) =>
    p.checkins.flatMap((c, w) => {
      if (!c) return [];
      // Spread submissions across Mon–Fri, never in the future.
      const at = new Date(`${addDays(weeks[w], c.day)}T15:00:00Z`);
      const submittedAt = at > now ? now : at;
      return [
        {
          personId: personId(p.index),
          weekStart: weeks[w],
          mood: c.mood,
          energy: c.energy,
          stress: c.stress,
          workload: c.workload,
          belonging: c.belonging,
          note: c.note,
          noteShared: c.shared,
          submittedAt,
          updatedAt: submittedAt,
        },
      ];
    }),
  );
  await tx.insert(schema.checkins).values(rows);

  return {
    departments: Object.keys(SAMPLE_DEPARTMENTS).length,
    teams: teamIds.size,
    people: inserted.length,
    checkins: rows.length,
    weeks,
  };
}

/** Deletes sample people (and, by cascade, their check-ins) and sample departments (and their teams). */
export async function removeSampleData(tx: Tx, orgId: string) {
  const { people, departments } = schema;
  const removed = await tx
    .delete(people)
    .where(and(eq(people.orgId, orgId), eq(people.isSample, true)))
    .returning({ id: people.id });
  const depts = await tx
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.orgId, orgId), eq(departments.isSample, true)));
  if (depts.length) {
    await tx.delete(departments).where(inArray(departments.id, depts.map((d) => d.id)));
  }
  return { people: removed.length };
}
