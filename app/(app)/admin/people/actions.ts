"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { isHrAdmin } from "@/lib/permissions";
import { getViewer } from "@/lib/viewer";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Case-insensitive equality (ilike would treat _ and % in names as wildcards). */
const sameText = (column: AnyColumn, value: string) => sql`lower(${column}) = lower(${value})`;

const fail = (error: string): ActionResult => ({ ok: false, error });
const done = (message: string): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true, message };
};

async function requireHrAdmin() {
  const viewer = await getViewer();
  return viewer && isHrAdmin(viewer) ? viewer : null;
}

async function personInOrg(orgId: string, id: string) {
  const [p] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.id, id), eq(schema.people.orgId, orgId)))
    .limit(1);
  return p ?? null;
}

async function teamInOrg(orgId: string, id: string) {
  const [t] = await db
    .select({ id: schema.teams.id, name: schema.teams.name })
    .from(schema.teams)
    .innerJoin(schema.departments, eq(schema.departments.id, schema.teams.departmentId))
    .where(and(eq(schema.teams.id, id), eq(schema.departments.orgId, orgId)))
    .limit(1);
  return t ?? null;
}

const role = z.enum(["employee", "manager", "hr_admin"]);
const id = z.uuid();

export async function updateRole(input: { personId: string; role: string }): Promise<ActionResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return fail("Only HR admins can change roles.");
  const parsed = z.object({ personId: id, role }).safeParse(input);
  if (!parsed.success) return fail("Pick a valid role.");
  const person = await personInOrg(viewer.org.id, parsed.data.personId);
  if (!person) return fail("That person isn’t in your organization.");
  if (person.id === viewer.person.id && parsed.data.role !== "hr_admin") {
    return fail("You can’t remove your own HR admin role. Ask another HR admin.");
  }
  await db.update(schema.people).set({ role: parsed.data.role }).where(eq(schema.people.id, person.id));
  const label = { employee: "an employee", manager: "a manager", hr_admin: "an HR admin" }[parsed.data.role];
  return done(`${person.name} is now ${label}.`);
}

export async function updateTeam(input: { personId: string; teamId: string | null }): Promise<ActionResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return fail("Only HR admins can change teams.");
  const parsed = z.object({ personId: id, teamId: id.nullable() }).safeParse(input);
  if (!parsed.success) return fail("Pick a valid team.");
  const person = await personInOrg(viewer.org.id, parsed.data.personId);
  if (!person) return fail("That person isn’t in your organization.");
  const team = parsed.data.teamId ? await teamInOrg(viewer.org.id, parsed.data.teamId) : null;
  if (parsed.data.teamId && !team) return fail("That team isn’t in your organization.");
  await db.update(schema.people).set({ teamId: team?.id ?? null }).where(eq(schema.people.id, person.id));
  return done(team ? `${person.name} moved to ${team.name}.` : `${person.name} is no longer on a team.`);
}

export async function setActive(input: { personId: string; active: boolean }): Promise<ActionResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return fail("Only HR admins can deactivate people.");
  const parsed = z.object({ personId: id, active: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("Something went wrong.");
  const person = await personInOrg(viewer.org.id, parsed.data.personId);
  if (!person) return fail("That person isn’t in your organization.");
  if (person.id === viewer.person.id && !parsed.data.active) return fail("You can’t deactivate yourself.");
  await db.update(schema.people).set({ active: parsed.data.active }).where(eq(schema.people.id, person.id));
  return done(
    parsed.data.active
      ? `${person.name} is active again.`
      : `${person.name} is deactivated: they can’t sign in and won’t get reminders. Their history is kept.`,
  );
}

/** Privacy request: permanently deletes every check-in (and note) by this person. */
export async function deleteCheckins(input: { personId: string }): Promise<ActionResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return fail("Only HR admins can delete check-ins.");
  const parsed = z.object({ personId: id }).safeParse(input);
  if (!parsed.success) return fail("Something went wrong.");
  const person = await personInOrg(viewer.org.id, parsed.data.personId);
  if (!person) return fail("That person isn’t in your organization.");
  const removed = await db
    .delete(schema.checkins)
    .where(eq(schema.checkins.personId, person.id))
    .returning({ id: schema.checkins.id });
  await db.insert(schema.auditLog).values({ actorId: viewer.person.id, subjectId: person.id, action: "delete_checkins" });
  return done(`Deleted ${removed.length} check-in${removed.length === 1 ? "" : "s"} for ${person.name}.`);
}

const addPersonSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  employeeCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{1,32}$/, "Employee ID may use letters, numbers, . _ - (max 32)."),
  role,
  teamId: z.union([id, z.literal("")]).transform((v) => v || null),
});

export async function addPerson(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return fail("Only HR admins can add people.");
  const parsed = addPersonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  const { name, email, employeeCode, role: r, teamId } = parsed.data;
  if (teamId && !(await teamInOrg(viewer.org.id, teamId))) return fail("That team isn’t in your organization.");
  const { people } = schema;
  const [emailTaken] = await db.select({ id: people.id }).from(people).where(eq(people.email, email)).limit(1);
  if (emailTaken) return fail(`${email} is already on the roster.`);
  const [codeTaken] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.orgId, viewer.org.id), sameText(people.employeeCode, employeeCode)))
    .limit(1);
  if (codeTaken) return fail(`Employee ID ${employeeCode} is already used.`);
  await db.insert(schema.people).values({ orgId: viewer.org.id, name, email, employeeCode, role: r, teamId });
  return done(`Added ${name}. They can sign in with ${email}.`);
}

const teamSchema = z.object({
  department: z.string().trim().min(1, "Enter a department.").max(100),
  team: z.string().trim().min(1, "Enter a team name.").max(100),
});

export async function addTeam(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return fail("Only HR admins can add teams.");
  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  const { department, team } = parsed.data;
  const { departments, teams } = schema;
  let [dept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.orgId, viewer.org.id), sameText(departments.name, department)))
    .limit(1);
  if (!dept) [dept] = await db.insert(departments).values({ orgId: viewer.org.id, name: department }).returning({ id: departments.id });
  const [exists] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.departmentId, dept.id), sameText(teams.name, team)))
    .limit(1);
  if (exists) return fail(`${department} already has a team called ${team}.`);
  await db.insert(teams).values({ departmentId: dept.id, name: team });
  return done(`Added ${team} to ${department}.`);
}

export async function setTeamManager(input: { teamId: string; managerId: string | null }): Promise<ActionResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return fail("Only HR admins can set managers.");
  const parsed = z.object({ teamId: id, managerId: id.nullable() }).safeParse(input);
  if (!parsed.success) return fail("Pick a valid manager.");
  const team = await teamInOrg(viewer.org.id, parsed.data.teamId);
  if (!team) return fail("That team isn’t in your organization.");
  if (parsed.data.managerId) {
    const [m] = await db
      .select({ name: schema.people.name })
      .from(schema.people)
      .where(
        and(
          eq(schema.people.id, parsed.data.managerId),
          eq(schema.people.orgId, viewer.org.id),
          eq(schema.people.active, true),
          inArray(schema.people.role, ["manager", "hr_admin"]),
        ),
      )
      .limit(1);
    if (!m) return fail("Managers must be active people with the manager or HR admin role.");
    await db.update(schema.teams).set({ managerId: parsed.data.managerId }).where(eq(schema.teams.id, team.id));
    return done(`${m.name} now manages ${team.name}.`);
  }
  await db.update(schema.teams).set({ managerId: null }).where(eq(schema.teams.id, team.id));
  return done(`${team.name} has no manager now.`);
}
