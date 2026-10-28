import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, FlaskConical } from "lucide-react";
import { Breakdown } from "@/components/dashboard/breakdown";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PeopleTable } from "@/components/dashboard/people-table";
import { PersonDrawer } from "@/components/dashboard/person-drawer";
import { SampleDataButton } from "@/components/sample/sample-data-button";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboard, getPerson } from "@/lib/dashboard";
import { parseParams } from "@/lib/dashboard-params";
import { canSeeDashboard, isHrAdmin } from "@/lib/permissions";
import { hasAnyCheckins, hasSampleData } from "@/lib/queries";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Health Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!canSeeDashboard(viewer)) redirect("/check-in");
  const hr = isHrAdmin(viewer);

  if (!(await hasAnyCheckins(viewer.org.id))) {
    return (
      <>
        <PageHeader title="Health Dashboard" />
        <Card className="flex flex-col items-start gap-3 p-[22px] sm:flex-row sm:items-center sm:gap-5">
          <span className="grid size-11 flex-none place-items-center rounded-full bg-brand-soft text-brand">
            <CalendarCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="mb-0.5 font-semibold">No check-ins yet</h2>
            <p className="max-w-[60ch] text-muted-foreground">
              Wellbeing trends appear here once people start checking in. The first check-in reminder goes out on
              Monday; you can get things started by submitting your own.
            </p>
          </div>
          <Link href="/check-in" className={buttonVariants()}>
            Do your check-in
          </Link>
        </Card>
        {hr && <SampleCallout />}
      </>
    );
  }

  const params = parseParams(await searchParams);
  const [data, person, sample] = await Promise.all([
    getDashboard(viewer, params),
    params.person ? getPerson(viewer, params.person) : null,
    hr ? hasSampleData(viewer.org.id) : false,
  ]);
  const { participation: p } = data;

  return (
    <>
      <PageHeader title="Health Dashboard">
        <span className="num">{p.checkedIn}</span> of <span className="num">{p.active}</span>{" "}
        {p.active === 1 ? "employee" : "employees"} checked in this week (<span className="num">{p.pct}%</span>{" "}
        participation). Indices are built from five 1–5 check-in questions and shown on a 0–100 scale.
      </PageHeader>

      {sample && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed border-border bg-surface px-4 py-2.5 text-[13px] text-muted-foreground">
          <FlaskConical className="size-4 text-brand" aria-hidden="true" />
          <span className="flex-1">Sample data is loaded. Sample people use SMP- IDs and can’t sign in.</span>
          <SampleDataButton mode="remove" variant="link" />
        </div>
      )}

      {!data.individual && (
        <p className="mb-4 rounded-lg bg-sunk px-4 py-2.5 text-[13px] text-muted-foreground">
          Your organization shows managers team-level results and at-risk flags only, not individual scores.
        </p>
      )}

      <div className="mb-6 grid gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="grid grid-cols-1 gap-4 min-[521px]:grid-cols-2">
          {data.kpis.map((k) => (
            <KpiCard key={k.key} metric={k.key} value={k.value} delta={k.delta} series={k.series} />
          ))}
        </div>
        <Breakdown breakdown={data.breakdown} individual={data.individual} minGroupSize={data.minGroupSize} />
      </div>

      <PeopleTable
        table={data.table}
        params={params}
        departments={data.departmentNames}
        individual={data.individual}
        storageKey={`steady:columns:${viewer.person.id}`}
      />
      <PersonDrawer person={person} />
    </>
  );
}

function SampleCallout() {
  return (
    <Card className="mt-4 flex flex-col items-start gap-3 p-[22px] sm:flex-row sm:items-center sm:gap-5">
      <span className="grid size-11 flex-none place-items-center rounded-full bg-sunk text-muted-foreground">
        <FlaskConical className="size-5" aria-hidden="true" />
      </span>
      <div className="flex-1">
        <h2 className="mb-0.5 font-semibold">Want to see it with data first?</h2>
        <p className="max-w-[60ch] text-muted-foreground">
          Load 42 sample people across 7 departments with 8 weeks of check-ins. They’re clearly marked, can’t sign
          in, and you can remove them in one click.
        </p>
      </div>
      <SampleDataButton mode="load" />
    </Card>
  );
}
