import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Viewer } from "@/lib/viewer";

// Who can see whom. Every loader and action calls these before reading wellbeing data;
// the UI never filters on its own.
//
//                               Employee   Manager                 HR admin
// Own check-ins and notes       yes        yes                     yes
// Direct reports' scores        no         yes (org setting)       yes
// Direct reports' notes         no         only when shared        only when shared
// Team / department aggregates  no         own teams               all
// Roster admin                  no         no                      yes

export class ForbiddenError extends Error {
  constructor(message = "You don’t have access to this.") {
    super(message);
  }
}

export function isHrAdmin(viewer: Viewer) {
  return viewer.person.role === "hr_admin";
}

export function canSeeDashboard(viewer: Viewer) {
  return viewer.person.role === "manager" || isHrAdmin(viewer);
}

/** Managers may be limited to aggregates + at-risk flags by the org setting. */
export function canSeeIndividualScores(viewer: Viewer) {
  return isHrAdmin(viewer) || (viewer.person.role === "manager" && viewer.org.managersSeeIndividualScores);
}

/** Teams whose aggregates the viewer may see: their own teams (manager) or every team (HR). */
export async function visibleTeamIds(viewer: Viewer): Promise<string[]> {
  const { teams, departments } = schema;
  if (isHrAdmin(viewer)) {
    const rows = await db
      .select({ id: teams.id })
      .from(teams)
      .innerJoin(departments, eq(departments.id, teams.departmentId))
      .where(eq(departments.orgId, viewer.org.id));
    return rows.map((r) => r.id);
  }
  if (viewer.person.role !== "manager") return [];
  const rows = await db.select({ id: teams.id }).from(teams).where(eq(teams.managerId, viewer.person.id));
  return rows.map((r) => r.id);
}

/**
 * People on the viewer's dashboard: every active person in the org (HR admin), or the
 * active members of the teams they manage, excluding themselves (manager). Employees: none.
 */
export async function visiblePersonIds(viewer: Viewer): Promise<string[]> {
  const { people } = schema;
  if (isHrAdmin(viewer)) {
    const rows = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.orgId, viewer.org.id), eq(people.active, true)));
    return rows.map((r) => r.id);
  }
  const teamIds = await visibleTeamIds(viewer);
  if (!teamIds.length) return [];
  const rows = await db
    .select({ id: people.id })
    .from(people)
    .where(and(inArray(people.teamId, teamIds), eq(people.active, true), ne(people.id, viewer.person.id)));
  return rows.map((r) => r.id);
}

export async function canViewPerson(viewer: Viewer, personId: string) {
  if (personId === viewer.person.id) return true;
  if (!canSeeIndividualScores(viewer)) return false;
  return (await visiblePersonIds(viewer)).includes(personId);
}

/**
 * A note is returned only to its author, or to someone allowed to see the author when the
 * author chose to share it. Private notes never leave the server for anyone else, HR included.
 */
export function visibleNote(viewer: Viewer, row: { personId: string; note: string; noteShared: boolean }) {
  if (row.personId === viewer.person.id) return row.note;
  return row.noteShared ? row.note : null;
}

/** Records that a manager or admin read someone's individual check-ins. */
export async function logIndividualRead(viewer: Viewer, subjectId: string, action = "view_person") {
  if (subjectId === viewer.person.id) return;
  await db.insert(schema.auditLog).values({ actorId: viewer.person.id, subjectId, action });
}
