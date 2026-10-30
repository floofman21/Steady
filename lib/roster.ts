import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Everything the People page shows: every person (active or not) and every team. */
export async function getRoster(orgId: string) {
  const { people, teams, departments, checkins } = schema;
  const [rows, teamRows, counts] = await Promise.all([
    db
      .select({
        id: people.id,
        name: people.name,
        email: people.email,
        employeeCode: people.employeeCode,
        role: people.role,
        active: people.active,
        isSample: people.isSample,
        teamId: people.teamId,
      })
      .from(people)
      .where(eq(people.orgId, orgId))
      .orderBy(asc(people.name)),
    db
      .select({
        id: teams.id,
        name: teams.name,
        department: departments.name,
        managerId: teams.managerId,
      })
      .from(teams)
      .innerJoin(departments, eq(departments.id, teams.departmentId))
      .where(eq(departments.orgId, orgId))
      .orderBy(asc(departments.name), asc(teams.name)),
    db
      .select({ personId: checkins.personId, n: count() })
      .from(checkins)
      .innerJoin(people, eq(people.id, checkins.personId))
      .where(eq(people.orgId, orgId))
      .groupBy(checkins.personId),
  ]);
  const checkinCount = new Map(counts.map((c) => [c.personId, c.n]));
  return {
    people: rows.map((p) => ({ ...p, checkins: checkinCount.get(p.id) ?? 0 })),
    teams: teamRows.map((t) => ({ ...t, members: rows.filter((p) => p.teamId === t.id && p.active).length })),
  };
}

export type Roster = Awaited<ReturnType<typeof getRoster>>;
