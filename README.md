# Steady

Weekly wellbeing check-ins for employees, and a team health dashboard for managers and HR.
Built from `Steady_Build_Spec.md`; the single-file prototype is the visual and behavioral reference.

**Status:** Phases 1–2 — foundation, scoring, and the Weekly Check-in page.
Auth is stubbed: until Phase 3 every request runs as the seeded HR admin (`lib/viewer.ts`).

## Stack

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS v4 + shadcn/ui · Recharts · Postgres (Neon) ·
Drizzle ORM + drizzle-kit · Auth.js v5 · Resend · Netlify Scheduled Functions · Zod · Vitest + Playwright.

## Local setup

Requires Node 22+, pnpm 10, and a Postgres 16 database.

```bash
pnpm install
cp .env.example .env          # used by drizzle-kit and the seed script
cp .env.example .env.local    # used by Next.js
# point DATABASE_URL at your database, e.g. postgres://postgres:postgres@localhost:5432/steady

pnpm db:migrate               # apply migrations in /drizzle
pnpm db:seed                  # 42 sample people, 13 teams, 8 weeks of check-ins
pnpm dev                      # http://localhost:3000
```

The seed is the prototype's sample org, generated with the same seeded RNG, so the dashboard numbers match the
prototype. Its last week is anchored to the current week. **It deletes all org data first and refuses to run when
`NODE_ENV` is `production` or Netlify's `CONTEXT` is `production`.**

| Script | Does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint / route types + `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (scoring, weeks, check-in validation) |
| `pnpm db:generate` | Generate a migration from `lib/db/schema.ts` into `/drizzle` |
| `pnpm db:migrate` | Apply pending migrations to your local database |
| `pnpm db:seed` | Replace all data with the sample org (local and preview only) |

## Environment variables

| Name | Used for | Phase |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon's pooled string in production) | 1 |
| `DATABASE_URL_UNPOOLED` | Optional direct string for migrations (Neon's non-pooled string) | 1 |
| `AUTH_SECRET` | Auth.js session encryption | 3 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in | 3 |
| `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Microsoft sign-in | 3 |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated sign-in allowlist; the seed uses the first one for sample emails | 3 |
| `RESEND_API_KEY`, `EMAIL_FROM` | Reminder and digest emails | 5 |
| `CRON_SECRET` | Protects `/api/cron/*` | 5 |

## Deploying to Netlify

The database is an external Postgres on [Neon](https://neon.tech) (free tier is enough); Netlify hosts the app.

1. **Neon:** create a project (pick the region closest to your Netlify functions, e.g. US East). On the project
   dashboard choose **Connect** and copy the connection string; keep **Connection pooling** on.
2. **Netlify:** **Add new project → Import an existing project → GitHub**, pick this repo. `netlify.toml` has the
   build settings.
3. **Environment variable:** in Netlify, **Project configuration → Environment variables → Add a variable**:
   key `DATABASE_URL`, value the Neon string, scopes include *Builds* and *Functions*. Optionally add
   `DATABASE_URL_UNPOOLED` with the non-pooled string (used only for migrations).
4. **Deploy.** Production deploys run `scripts/netlify-build.mjs`: `drizzle-kit migrate`, then `next build`.
   Deploy previews skip migrations. If previews should not touch production data, give the *Deploy Previews*
   context its own `DATABASE_URL` (a Neon branch).
5. Add the remaining env vars above as each phase needs them. Phase 5's weekly jobs will run as Netlify Scheduled
   Functions.

## Layout

```
app/
  (auth)/sign-in/        Sign-in (placeholder until phase 3)
  (app)/layout.tsx       App shell: sidebar, top bar, week pill
  (app)/dashboard/       Health Dashboard
  (app)/check-in/        Weekly Check-in + submitCheckin server action
  (app)/feed/            Check-in Feed
  (app)/admin/people/    Roster + CSV import (HR admin)
lib/
  db/schema.ts           Drizzle schema
  scoring.ts             Index math (pure)
  checkin.ts             Questions + Zod schema shared by form and server action
  week.ts                Week helpers in the org time zone
  viewer.ts              Signed-in person (stubbed until phase 3)
  queries.ts             Server-side reads
components/
  ui/                    shadcn/ui components
  shell/                 App shell
  checkin/               Check-in form and 1–5 scale
  shared/                Trend chart, index colors
scripts/
  seed.ts, sample-data.ts, netlify-build.mjs
tests/                   Vitest
drizzle/                 Migrations
```
