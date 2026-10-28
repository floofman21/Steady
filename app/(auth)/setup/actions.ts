"use server";

import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { setupSchema } from "@/lib/setup";

export type SetupState = { error?: string };

/** One-time: creates the organization and its first HR admin. Refuses once an org exists. */
export async function createOrganization(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { orgName, timezone, name, email, employeeCode } = parsed.data;

  const created = await db.transaction(async (tx) => {
    // Serialize concurrent setups so only the first one can create the org.
    await tx.execute(sql`select pg_advisory_xact_lock(424242)`);
    const [existing] = await tx.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
    if (existing) return false;
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: orgName, timezone })
      .returning({ id: schema.organizations.id });
    await tx.insert(schema.people).values({
      orgId: org.id,
      employeeCode: employeeCode || "EMP-0001",
      name,
      email,
      role: "hr_admin",
    });
    return true;
  });

  if (!created) return { error: "Steady is already set up. Reload the page to continue." };
  redirect("/dashboard");
}
