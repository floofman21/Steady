// pnpm db:seed — loads the prototype's sample org into a local or preview database.
// Replaces ALL org data. Refuses to run against production.

import "dotenv/config";

if (process.env.CONTEXT === "production" || process.env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const TIMEZONE = process.env.SEED_TIMEZONE ?? "America/New_York";
const EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAINS ?? "example.com").split(",")[0].trim() || "example.com";

async function main() {
  const { db, schema } = await import("../lib/db");
  const { insertSampleData } = await import("../lib/sample");
  const { sql } = await import("drizzle-orm");

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`truncate table audit_log, reminders_log, checkins, teams, people, departments, organizations restart identity cascade`,
    );
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: "Arkone", timezone: TIMEZONE, weekStartDay: 1, minGroupSize: 5 })
      .returning();
    const r = await insertSampleData(tx, {
      orgId: org.id,
      timezone: TIMEZONE,
      emailDomain: EMAIL_DOMAIN,
      codePrefix: "EMP-",
      withHrAdmin: true,
    });
    console.log(
      `Seeded org "${org.name}": ${r.departments} departments, ${r.teams} teams, ${r.people} people, ` +
        `${r.checkins} check-ins over ${r.weeks.length} weeks (${r.weeks[0]} → ${r.weeks[r.weeks.length - 1]}).`,
    );
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
