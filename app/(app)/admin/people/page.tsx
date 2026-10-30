import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AddPersonSheet } from "@/components/people/add-person-sheet";
import { ImportSheet } from "@/components/people/import-sheet";
import { RosterTable } from "@/components/people/roster-table";
import { TeamsCard } from "@/components/people/teams-card";
import { SampleDataButton } from "@/components/sample/sample-data-button";
import { PageHeader } from "@/components/shared/page-header";
import { isHrAdmin } from "@/lib/permissions";
import { hasSampleData } from "@/lib/queries";
import { getRoster } from "@/lib/roster";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!isHrAdmin(viewer)) redirect("/check-in");
  const [roster, sample] = await Promise.all([getRoster(viewer.org.id), hasSampleData(viewer.org.id)]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <PageHeader title="People">
          Everyone on the roster can sign in with their work email. Deactivated people can’t sign in and don’t get
          reminders; their history is kept.
        </PageHeader>
        <div className="mb-5 flex gap-2.5">
          <AddPersonSheet teams={roster.teams} />
          <ImportSheet />
        </div>
      </div>

      <RosterTable roster={roster} viewerId={viewer.person.id} />
      <TeamsCard roster={roster} />

      <section
        aria-label="Sample data"
        className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border px-4 py-3.5 sm:flex-row sm:items-center"
      >
        <p className="flex-1 text-[13px] text-muted-foreground">
          {sample
            ? "Sample data is loaded (people marked Sample, SMP- IDs). Removing it leaves your real people and check-ins untouched."
            : "Want to explore first? Load 42 sample people with 8 weeks of check-ins; remove them any time."}
        </p>
        <SampleDataButton mode={sample ? "remove" : "load"} />
      </section>
    </>
  );
}
