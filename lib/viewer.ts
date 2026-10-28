import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";

export type Viewer = {
  person: typeof schema.people.$inferSelect;
  org: typeof schema.organizations.$inferSelect;
};

/** The signed-in person: the session's email matched to an active row in `people`. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const rows = await db
    .select({ person: schema.people, org: schema.organizations })
    .from(schema.people)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.people.orgId))
    .where(and(eq(schema.people.email, email), eq(schema.people.active, true)))
    .limit(1);
  return rows[0] ?? null;
});
