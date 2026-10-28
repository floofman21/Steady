import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasAnyCheckins, participation } from "@/lib/queries";
import { canSeeDashboard, getViewer } from "@/lib/viewer";
import { weekStartOf } from "@/lib/week";

export const metadata: Metadata = { title: "Health Dashboard" };

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!canSeeDashboard(viewer)) redirect("/check-in");

  const { org } = viewer;
  const { active, checkedIn } = await participation(org.id, weekStartOf(new Date(), org.timezone, org.weekStartDay));
  const pct = active ? Math.round((checkedIn / active) * 100) : 0;

  if (!(await hasAnyCheckins(org.id))) {
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
      </>
    );
  }

  return (
    <>
      <PageHeader title="Health Dashboard">
        <span className="num">{checkedIn}</span> of <span className="num">{active}</span> employees checked in this
        week (<span className="num">{pct}%</span> participation). Indices are built from five 1–5 check-in questions
        and shown on a 0–100 scale.
      </PageHeader>
      <ComingSoon
        phase={4}
        items={[
          "Four KPI cards with week-over-week deltas and 8-week sparklines",
          "Breakdown by people needing attention, team and department",
          "Searchable, sortable employee table with a person drawer",
        ]}
      />
    </>
  );
}
