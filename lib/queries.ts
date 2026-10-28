import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** People with a check-in in `weekStart` ÷ active people. */
export async function participation(orgId: string, weekStart: string) {
  const { checkins, people } = schema;
  const [row] = await db
    .select({
      active: sql<number>`count(*)::int`,
      checkedIn: sql<number>`count(${checkins.id})::int`,
    })
    .from(people)
    .leftJoin(checkins, and(eq(checkins.personId, people.id), eq(checkins.weekStart, weekStart)))
    .where(and(eq(people.orgId, orgId), eq(people.active, true)));
  return row;
}

/** The person's own check-ins for the `weeks` most recent weeks, oldest first. */
export async function getMyHistory(personId: string, weeks: string[]) {
  const { checkins } = schema;
  const rows = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.personId, personId), inArray(checkins.weekStart, weeks)));
  const byWeek = new Map(rows.map((r) => [r.weekStart, r]));
  return weeks.map((weekStart) => ({ weekStart, checkin: byWeek.get(weekStart) ?? null }));
}

export async function hasAnyCheckins(orgId: string) {
  const { checkins, people } = schema;
  const [row] = await db
    .select({ id: checkins.id })
    .from(checkins)
    .innerJoin(people, eq(people.id, checkins.personId))
    .where(eq(people.orgId, orgId))
    .limit(1);
  return Boolean(row);
}

export async function hasSampleData(orgId: string) {
  const [row] = await db
    .select({ id: schema.people.id })
    .from(schema.people)
    .where(and(eq(schema.people.orgId, orgId), eq(schema.people.isSample, true)))
    .limit(1);
  return Boolean(row);
}
