import { execSync } from "node:child_process";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "../playwright.config";
import { MARKERS } from "./helpers";

export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = postgres({ ...parse(url), database: "postgres" });
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DATABASE_URL_UNPOOLED: "" };
  execSync("pnpm drizzle-kit migrate", { env, stdio: "inherit" });
  execSync("pnpm db:seed", { env, stdio: "inherit" });

  // Two marked notes on Priya Sharma's Platform team: one private, one shared.
  const sql = postgres(E2E_DATABASE_URL);
  // Relabel two existing notes (KPIs are unaffected): a private note on an employee's
  // check-in this week (so they see it prefilled) and a shared note on their previous one.
  // The employee's team manager is the non-author who must never receive the private note.
  const [{ current }] = await sql<{ current: string }[]>`select max(week_start)::text as current from checkins`;
  const [author] = await sql<{ id: string }[]>`
    select p.id from people p join teams t on t.id = p.team_id
    where p.role = 'employee' and t.manager_id is not null
      and exists (select 1 from checkins c where c.person_id = p.id and c.week_start = ${current})
      and exists (select 1 from checkins c where c.person_id = p.id
                  and c.week_start = (${current}::date - 7))
    order by p.name limit 1`;
  if (!author) throw new Error("Seed data changed: no employee checked in this week and last week.");
  await sql`update checkins set note = ${MARKERS.privateNote}, note_shared = false
            where person_id = ${author.id} and week_start = ${current}`;
  await sql`update checkins set note = ${MARKERS.sharedNote}, note_shared = true
            where person_id = ${author.id} and week_start = (${current}::date - 7)`;
  await sql.end();
}

function parse(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}
