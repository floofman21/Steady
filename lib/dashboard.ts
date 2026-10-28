import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  canSeeIndividualScores,
  canViewPerson,
  logIndividualRead,
  visibleNote,
  visiblePersonIds,
  visibleTeamIds,
} from "@/lib/permissions";
import { computeIndices, INDICES, isAtRisk, meanIndices, type IndexKey, type Indices } from "@/lib/scoring";
import type { Viewer } from "@/lib/viewer";
import { addWeeks, recentWeeks, weekStartOf } from "@/lib/week";
import type { DashboardParams } from "@/lib/dashboard-params";

export const WEEKS = 8;

// ---------- Scope: the people and check-ins a viewer may see ----------

export type ScopedPerson = {
  id: string;
  name: string;
  employeeCode: string;
  teamId: string | null;
  team: string | null;
  departmentId: string | null;
  department: string | null;
  /** 8 weeks, oldest first; null = no check-in that week. */
  series: (Indices | null)[];
  latest: { weekIndex: number; indices: Indices } | null;
  atRisk: boolean;
};

type Scope = {
  weeks: string[];
  current: string;
  people: ScopedPerson[];
  individual: boolean;
  minGroupSize: number;
};

async function loadScope(viewer: Viewer): Promise<Scope> {
  const { org } = viewer;
  const current = weekStartOf(new Date(), org.timezone, org.weekStartDay);
  const weeks = recentWeeks(current, WEEKS);
  const ids = await visiblePersonIds(viewer);
  const individual = canSeeIndividualScores(viewer);
  if (!ids.length) return { weeks, current, people: [], individual, minGroupSize: org.minGroupSize };

  const { people, teams, departments, checkins } = schema;
  const [rows, cks] = await Promise.all([
    db
      .select({
        id: people.id,
        name: people.name,
        employeeCode: people.employeeCode,
        teamId: teams.id,
        team: teams.name,
        departmentId: departments.id,
        department: departments.name,
      })
      .from(people)
      .leftJoin(teams, eq(teams.id, people.teamId))
      .leftJoin(departments, eq(departments.id, teams.departmentId))
      .where(inArray(people.id, ids)),
    db
      .select({
        personId: checkins.personId,
        weekStart: checkins.weekStart,
        mood: checkins.mood,
        energy: checkins.energy,
        stress: checkins.stress,
        workload: checkins.workload,
        belonging: checkins.belonging,
      })
      .from(checkins)
      .where(and(inArray(checkins.personId, ids), inArray(checkins.weekStart, weeks))),
  ]);

  const byPerson = new Map<string, (Indices | null)[]>();
  for (const id of ids) byPerson.set(id, Array(WEEKS).fill(null));
  for (const c of cks) byPerson.get(c.personId)![weeks.indexOf(c.weekStart)] = computeIndices(c);

  return {
    weeks,
    current,
    individual,
    minGroupSize: org.minGroupSize,
    people: rows.map((r) => {
      const series = byPerson.get(r.id)!;
      let latest: ScopedPerson["latest"] = null;
      for (let w = WEEKS - 1; w >= 0; w--) {
        if (series[w]) {
          latest = { weekIndex: w, indices: series[w]! };
          break;
        }
      }
      return { ...r, series, latest, atRisk: latest ? isAtRisk(latest.indices) : false };
    }),
  };
}

// ---------- Dashboard ----------

export type Kpi = {
  key: IndexKey;
  value: number | null;
  delta: number | null;
  series: (number | null)[];
};

export type GroupRow = {
  id: string;
  name: string;
  sub: string | null;
  members: number;
  respondents: number;
  atRisk: number;
  /** Mean of each member's latest index, rounded; null when below the minimum group size. */
  indices: Indices | null;
};

export type TableRow = {
  id: string;
  name: string;
  employeeCode: string;
  department: string | null;
  team: string | null;
  /** Null when the viewer may not see individual scores, or the person has never checked in. */
  indices: Indices | null;
  atRisk: boolean;
  lastWeek: string | null;
  missedThisWeek: boolean;
};

export async function getDashboard(viewer: Viewer, params: DashboardParams) {
  const scope = await loadScope(viewer);
  const { people, weeks, individual, minGroupSize } = scope;
  const cur = WEEKS - 1;

  // Org KPI per week = mean over check-ins submitted that week (not latest per person).
  const weekly = weeks.map((_, w) => {
    const list = people.map((p) => p.series[w]).filter((x): x is Indices => x !== null);
    return { n: list.length, mean: meanIndices(list) };
  });
  const enough = weekly[cur].n >= minGroupSize;
  const kpis: Kpi[] = INDICES.map(({ key }) => {
    const series = weekly.map((wk) => (wk.n >= minGroupSize && wk.mean ? wk.mean[key] : null));
    const value = series[cur];
    const prev = series[cur - 1];
    return { key, value, delta: value != null && prev != null ? value - prev : null, series };
  });

  const checkedIn = weekly[cur].n;
  const active = people.length;

  // Breakdown rows. Team/department values = mean of each member's latest index.
  const group = (key: "teamId" | "departmentId", nameKey: "team" | "department", allowed: Set<string> | null) => {
    const groups = new Map<string, ScopedPerson[]>();
    for (const p of people) {
      const id = p[key];
      if (!id || (allowed && !allowed.has(id))) continue;
      groups.set(id, [...(groups.get(id) ?? []), p]);
    }
    return [...groups.entries()]
      .map(([id, ms]): GroupRow => {
        const respondents = ms.filter((m) => m.series[cur]).length;
        const mean = meanIndices(ms.flatMap((m) => (m.latest ? [m.latest.indices] : [])));
        const shown = respondents >= minGroupSize && mean;
        return {
          id,
          name: ms[0][nameKey] ?? "—",
          sub: key === "teamId" ? ms[0].department : null,
          members: ms.length,
          respondents,
          atRisk: ms.filter((m) => m.atRisk).length,
          indices: shown
            ? (Object.fromEntries(INDICES.map(({ key: k }) => [k, Math.round(mean[k])])) as Indices)
            : null,
        };
      })
      .sort((a, b) => (b.indices?.burnout ?? -1) - (a.indices?.burnout ?? -1) || a.name.localeCompare(b.name));
  };
  const teamScope = new Set(await visibleTeamIds(viewer));
  const teams = group("teamId", "team", teamScope);
  const departments = group("departmentId", "department", null);

  const needsAttention = individual
    ? people
        .filter((p) => p.atRisk)
        .sort((a, b) => b.latest!.indices.burnout - a.latest!.indices.burnout)
        .map((p) => ({ id: p.id, name: p.name, team: p.team, department: p.department, indices: p.latest!.indices }))
    : [];

  // Table: filter → sort → page.
  const q = params.q.toLowerCase();
  const filtered = people.filter(
    (p) =>
      (!params.dept || p.department === params.dept) &&
      (!q ||
        p.name.toLowerCase().includes(q) ||
        p.employeeCode.toLowerCase().includes(q) ||
        (p.team ?? "").toLowerCase().includes(q)) &&
      (!params.risk || p.atRisk),
  );
  const sortValue = (p: ScopedPerson): string | number => {
    switch (params.sort) {
      case "name":
        return p.name.toLowerCase();
      case "id":
        return p.employeeCode;
      case "dept":
        return (p.department ?? "").toLowerCase();
      case "last":
        return p.latest?.weekIndex ?? -1;
      default:
        return individual ? (p.latest?.indices[params.sort] ?? -1) : p.atRisk ? 1 : 0;
    }
  };
  const sign = params.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    const x = sortValue(a);
    const y = sortValue(b);
    return (x > y ? 1 : x < y ? -1 : a.name.localeCompare(b.name)) * sign;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / params.per));
  const page = Math.min(params.page, pages);
  const rows: TableRow[] = filtered.slice((page - 1) * params.per, page * params.per).map((p) => ({
    id: p.id,
    name: p.name,
    employeeCode: p.employeeCode,
    department: p.department,
    team: p.team,
    indices: individual ? (p.latest?.indices ?? null) : null,
    atRisk: p.atRisk,
    lastWeek: p.latest ? weeks[p.latest.weekIndex] : null,
    missedThisWeek: !p.series[cur],
  }));

  return {
    weeks,
    current: scope.current,
    individual,
    minGroupSize,
    participation: { checkedIn, active, pct: active ? Math.round((checkedIn / active) * 100) : 0 },
    kpisShown: enough,
    kpis,
    breakdown: { needsAttention, teams, departments },
    departmentNames: [...new Set(people.map((p) => p.department).filter((d): d is string => !!d))].sort(),
    table: { rows, total: filtered.length, page, pages },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** At-risk count for the sidebar badge, over the people the viewer can see. */
export async function countVisibleAtRisk(viewer: Viewer) {
  return (await loadScope(viewer)).people.filter((p) => p.atRisk).length;
}

// ---------- Person drawer ----------

export async function getPerson(viewer: Viewer, personId: string) {
  if (!(await canViewPerson(viewer, personId))) return null;
  const { people, teams, departments, checkins } = schema;
  const [person] = await db
    .select({
      id: people.id,
      name: people.name,
      employeeCode: people.employeeCode,
      team: teams.name,
      department: departments.name,
    })
    .from(people)
    .leftJoin(teams, eq(teams.id, people.teamId))
    .leftJoin(departments, eq(departments.id, teams.departmentId))
    .where(and(eq(people.id, personId), eq(people.orgId, viewer.org.id)))
    .limit(1);
  if (!person) return null;

  const current = weekStartOf(new Date(), viewer.org.timezone, viewer.org.weekStartDay);
  const weeks = recentWeeks(current, WEEKS);
  const rows = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.personId, personId), inArray(checkins.weekStart, weeks)))
    .orderBy(desc(checkins.weekStart));
  await logIndividualRead(viewer, personId);

  const series = weeks.map((w) => {
    const c = rows.find((r) => r.weekStart === w);
    return { weekStart: w, indices: c ? computeIndices(c) : null };
  });
  const latest = rows[0] ?? null;
  const notes = rows
    .filter((r) => r.noteShared && r.note)
    .map((r) => ({ weekStart: r.weekStart, note: visibleNote(viewer, r)! }))
    .slice(0, 3);

  return {
    ...person,
    current: latest ? computeIndices(latest) : null,
    lastWeek: latest?.weekStart ?? null,
    missedThisWeek: latest?.weekStart !== current,
    series,
    completed: rows.length,
    notes,
  };
}

export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPerson>>>;

// ---------- Feed ----------

export async function getFeed(viewer: Viewer, opts: { dept: string; sharedOnly: boolean }) {
  const current = weekStartOf(new Date(), viewer.org.timezone, viewer.org.weekStartDay);
  const individual = canSeeIndividualScores(viewer);
  const ids = individual ? await visiblePersonIds(viewer) : [];
  if (!ids.length) return { individual, entries: [], departments: [] as string[] };

  const { people, teams, departments, checkins } = schema;
  const rows = await db
    .select({
      id: checkins.id,
      personId: checkins.personId,
      name: people.name,
      team: teams.name,
      department: departments.name,
      weekStart: checkins.weekStart,
      submittedAt: checkins.submittedAt,
      mood: checkins.mood,
      energy: checkins.energy,
      stress: checkins.stress,
      workload: checkins.workload,
      belonging: checkins.belonging,
      note: checkins.note,
      noteShared: checkins.noteShared,
    })
    .from(checkins)
    .innerJoin(people, eq(people.id, checkins.personId))
    .leftJoin(teams, eq(teams.id, people.teamId))
    .leftJoin(departments, eq(departments.id, teams.departmentId))
    .where(and(inArray(checkins.personId, ids), inArray(checkins.weekStart, [current, addWeeks(current, -1)])))
    .orderBy(desc(checkins.submittedAt));

  const entries = rows
    .map((r) => {
      const note = visibleNote(viewer, r);
      // Private notes are stripped here, before anything is sent to the browser.
      return {
        id: r.id,
        personId: r.personId,
        name: r.name,
        team: r.team,
        department: r.department,
        weekStart: r.weekStart,
        submittedAt: r.submittedAt.toISOString(),
        indices: computeIndices(r),
        note: note || null,
        hadPrivateNote: !note && Boolean(r.note),
      };
    })
    .filter((e) => (!opts.dept || e.department === opts.dept) && (!opts.sharedOnly || e.note));

  return {
    individual,
    entries,
    departments: [...new Set(rows.map((r) => r.department).filter((d): d is string => !!d))].sort(),
  };
}
