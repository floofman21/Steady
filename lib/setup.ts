import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";

/** True once an organization exists. Before that, the app sends everyone to /setup. */
export async function isSetUp() {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.organizations);
  return row.n > 0;
}

export const setupSchema = z.object({
  orgName: z.string().trim().min(1, "Enter your organization’s name.").max(120),
  timezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC", "Pick a time zone."),
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.email("Enter a valid work email.").trim().toLowerCase(),
  employeeCode: z.string().trim().max(32).optional(),
});

export type SetupInput = z.infer<typeof setupSchema>;
