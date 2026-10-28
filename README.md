# Steady

Weekly wellbeing check-ins for employees, and a team health dashboard for managers and HR.
Built from `Steady_Build_Spec.md`; the single-file prototype is the visual and behavioral reference.

**Status:** Phases 1–4 — foundation, weekly check-in, sign-in and permissions, Health Dashboard and Check-in Feed.
Phase 5 (People admin, CSV import, reminder and digest emails) is next.

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
| `pnpm test` | Vitest unit tests (scoring, weeks, validation, email domains) |
| `pnpm test:e2e` | Playwright: builds the app, creates and seeds a `steady_e2e` database, runs access and dashboard tests |
| `pnpm db:generate` | Generate a migration from `lib/db/schema.ts` into `/drizzle` |
| `pnpm db:migrate` | Apply pending migrations to your local database |
| `pnpm db:seed` | Replace all data with the sample org (local and preview only) |

## Environment variables

| Name | Used for | Phase |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon's pooled string in production) | 1 |
| `DATABASE_URL_UNPOOLED` | Optional direct string for migrations (Neon's non-pooled string) | 1 |
| `AUTH_SECRET` | Auth.js session encryption. **Required.** Generate with `openssl rand -base64 32` | 3 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in (enabled when both are set) | 3 |
| `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | Microsoft sign-in (enabled when ID and secret are set) | 3 |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated sign-in allowlist, e.g. `arkone.com`. Unset = any domain (people must still be on the roster) | 3 |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email sign-in links (when both are set) and, in phase 5, reminder emails | 3 |
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

## Sign-in

Steady signs people in with Google, Microsoft or an emailed link: whichever are configured. A person can sign in
only if their email is on the roster (`people`, active) and its domain is in `ALLOWED_EMAIL_DOMAINS`; anyone else
sees "Ask HR to add you to Steady" and nothing is created for them. The first HR admin is created on `/setup`, which
only works while the database has no organization.

- **Google:** Google Cloud console → APIs & Services → Credentials → Create OAuth client ID (Web application).
  Authorized redirect URI: `https://<your-site>/api/auth/callback/google`. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
- **Microsoft:** Microsoft Entra admin center → App registrations → New registration. Redirect URI (Web):
  `https://<your-site>/api/auth/callback/microsoft-entra-id`. Create a client secret. Set `AUTH_MICROSOFT_ENTRA_ID_ID`
  (Application ID), `AUTH_MICROSOFT_ENTRA_ID_SECRET`, and `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
  (`https://login.microsoftonline.com/<tenant-id>/v2.0/`).
- **Email link:** a Resend API key and `EMAIL_FROM`. Until you verify a domain in Resend, use
  `EMAIL_FROM="Steady <onboarding@resend.dev>"`; Resend then only delivers to your own Resend account's email.

## Privacy and permissions

All visibility rules live in `lib/permissions.ts` and run on the server; the UI never filters on its own.
Employees see only their own check-ins. Managers see their direct reports (members of the teams they manage) and
those teams' aggregates; HR admins see everyone. Notes reach a manager or HR admin only when their author shared
them; private notes never leave the server for anyone else. Team and department aggregates with fewer than
`min_group_size` (default 5) responses that week show "Not enough responses to display". Opening a person's drawer
writes `audit_log`. `organizations.managers_see_individual_scores` (default on) limits managers to aggregates and
at-risk flags when turned off.

## Sample data

HR admins can **Load sample data** from the empty dashboard or the People page: 42 people across 7 departments
with 8 weeks of check-ins, marked `is_sample`, using `SMP-` IDs and `example.com` emails (they can't sign in).
**Remove sample data** deletes exactly those people, their check-ins, and the sample departments and teams.

## Layout

```
app/
  (auth)/sign-in/        Sign-in (Google, Microsoft, email link)
  (auth)/setup/          First-run: create the org and first HR admin
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
  viewer.ts              Signed-in person (session email → people row)
  permissions.ts         Who can see whom (visibility matrix, notes, audit log)
  dashboard.ts           Dashboard, person drawer and feed loaders
  sample.ts              Load/remove sample data
  queries.ts             Server-side reads
components/
  ui/                    shadcn/ui components
  shell/                 App shell
  checkin/               Check-in form and 1–5 scale
  shared/                Trend chart, index colors
scripts/
  seed.ts, sample-data.ts, netlify-build.mjs
tests/                   Vitest
e2e/                     Playwright
auth.ts, auth.config.ts  Auth.js (full config / database-free part used by proxy.ts)
proxy.ts                 Redirects signed-out visitors to /sign-in
drizzle/                 Migrations
```
