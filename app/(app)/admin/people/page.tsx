import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SampleDataButton } from "@/components/sample/sample-data-button";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { isHrAdmin } from "@/lib/permissions";
import { hasSampleData } from "@/lib/queries";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!isHrAdmin(viewer)) redirect("/check-in");
  const sample = await hasSampleData(viewer.org.id);
  return (
    <>
      <PageHeader title="People">Manage the roster, roles and teams.</PageHeader>
      <Card className="mb-4 flex flex-col items-start gap-3 p-[22px] sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="mb-0.5 font-semibold">Sample data</h2>
          <p className="max-w-[60ch] text-muted-foreground">
            {sample
              ? "42 sample people (SMP- IDs) with 8 weeks of check-ins are loaded. Removing them leaves your real people and check-ins untouched."
              : "Add 42 sample people across 7 departments with 8 weeks of check-ins to explore the dashboard. You can remove them at any time."}
          </p>
        </div>
        <SampleDataButton mode={sample ? "remove" : "load"} />
      </Card>
      <ComingSoon
        phase={5}
        items={["Roster table with role and team editing", "CSV import with a row-level error preview"]}
      />
    </>
  );
}
