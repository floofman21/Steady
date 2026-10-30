import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ExistingPerson, ImportRow } from "@/lib/roster-import";

/** The org's current roster, in the shape validateImport() compares against. */
export async function existingRoster(orgId: string): Promise<ExistingPerson[]> {
  const { people, teams, departments } = schema;
  return db
    .select({
      employeeCode: people.employeeCode,
      email: people.email,
      name: people.name,
      role: people.role,
      department: departments.name,
      team: teams.name,
      active: people.active,
      isSample: people.isSample,
    })
    .from(people)
    .leftJoin(teams, eq(teams.id, people.teamId))
    .leftJoin(departments, eq(departments.id, teams.departmentId))
    .where(eq(people.orgId, orgId));
}

/**
 * Applies validated rows in one transaction: creates missing departments and teams
 * (matched case-insensitively), creates or updates people by employee_code (re-activating
 * anyone listed), then sets each team's manager from manager_email. People missing from
 * the file are left as they are.
 */
export async function applyImport(orgId: string, rows: ImportRow[]) {
  const { people, teams, departments } = schema;
  return db.transaction(async (tx) => {
    const key = (s: string) => s.trim().toLowerCase();

    // Departments.
    const deptRows = await tx.select().from(departments).where(eq(departments.orgId, orgId));
    const deptId = new Map(deptRows.map((d) => [key(d.name), d.id]));
    let departmentsCreated = 0;
    for (const r of rows) {
      if (deptId.has(key(r.department))) continue;
      const [d] = await tx.insert(departments).values({ orgId, name: r.department }).returning({ id: departments.id });
      deptId.set(key(r.department), d.id);
      departmentsCreated++;
    }

    // Teams (unique per department).
    const teamRows = deptRows.length
      ? await tx.select().from(teams).where(inArray(teams.departmentId, [...deptId.values()]))
      : [];
    const teamKey = (deptIdValue: string, team: string) => `${deptIdValue}\u0000${key(team)}`;
    const teamId = new Map(teamRows.map((t) => [teamKey(t.departmentId, t.name), t.id]));
    let teamsCreated = 0;
    for (const r of rows) {
      const d = deptId.get(key(r.department))!;
      if (teamId.has(teamKey(d, r.team))) continue;
      const [t] = await tx.insert(teams).values({ departmentId: d, name: r.team }).returning({ id: teams.id });
      teamId.set(teamKey(d, r.team), t.id);
      teamsCreated++;
    }

    // People, matched by employee_code.
    const existing = await tx
      .select({ id: people.id, code: people.employeeCode })
      .from(people)
      .where(eq(people.orgId, orgId));
    const idByCode = new Map(existing.map((p) => [key(p.code), p.id]));
    let created = 0;
    let updated = 0;
    const idByEmail = new Map<string, string>();
    for (const r of rows) {
      const values = {
        name: r.name,
        email: r.email,
        role: r.role,
        teamId: teamId.get(teamKey(deptId.get(key(r.department))!, r.team))!,
        active: true,
      };
      const id = idByCode.get(key(r.employeeCode));
      if (id) {
        await tx.update(people).set(values).where(eq(people.id, id));
        idByEmail.set(r.email, id);
        updated++;
      } else {
        const [p] = await tx
          .insert(people)
          .values({ ...values, orgId, employeeCode: r.employeeCode })
          .returning({ id: people.id });
        idByEmail.set(r.email, p.id);
        created++;
      }
    }

    // Team managers: from this file first, otherwise from the existing roster.
    const managerEmails = [...new Set(rows.map((r) => r.managerEmail).filter(Boolean))].filter((e) => !idByEmail.has(e));
    if (managerEmails.length) {
      const found = await tx
        .select({ id: people.id, email: people.email })
        .from(people)
        .where(and(eq(people.orgId, orgId), inArray(sql`lower(${people.email})`, managerEmails)));
      for (const m of found) idByEmail.set(m.email.toLowerCase(), m.id);
    }
    const managed = new Set<string>();
    for (const r of rows) {
      if (!r.managerEmail) continue;
      const t = teamId.get(teamKey(deptId.get(key(r.department))!, r.team))!;
      if (managed.has(t)) continue;
      managed.add(t);
      await tx.update(teams).set({ managerId: idByEmail.get(r.managerEmail)! }).where(eq(teams.id, t));
    }

    return { created, updated, departmentsCreated, teamsCreated, managersSet: managed.size };
  });
}
