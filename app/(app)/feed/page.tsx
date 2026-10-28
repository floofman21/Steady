import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedFilters } from "@/components/dashboard/feed-filters";
import { BAND_DOT, BAND_LABEL, bandOf } from "@/components/shared/index-style";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { getFeed } from "@/lib/dashboard";
import { canSeeDashboard } from "@/lib/permissions";
import { INDICES } from "@/lib/scoring";
import { cn, initials } from "@/lib/utils";
import { getViewer } from "@/lib/viewer";
import { formatWeekShort } from "@/lib/week";

export const metadata: Metadata = { title: "Check-in Feed" };

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!canSeeDashboard(viewer)) redirect("/check-in");

  const sp = await searchParams;
  const dept = typeof sp.dept === "string" ? sp.dept : "";
  const sharedOnly = sp.shared === "1";
  const feed = await getFeed(viewer, { dept, sharedOnly });
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: viewer.org.timezone });

  return (
    <>
      <PageHeader title="Check-in Feed">
        Check-ins from this week and last, newest first. Private notes are never shown; you’ll see the scores only.
      </PageHeader>
      {!feed.individual ? (
        <Card className="p-[22px] text-muted-foreground">
          Your organization shows managers team-level results only, so individual check-ins aren’t listed here.
        </Card>
      ) : (
        <>
          <FeedFilters departments={feed.departments} dept={dept} sharedOnly={sharedOnly} />
          <Card>
            {feed.entries.length ? (
              <ul className="m-0 list-none p-0">
                {feed.entries.map((e) => (
                  <li
                    key={e.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-border px-[18px] py-3.5 last:border-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                      {initials(e.name)}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/dashboard?person=${e.personId}`} className="font-semibold hover:underline">
                        {e.name}
                      </Link>{" "}
                      <span className="text-[12.5px] text-muted-foreground">
                        {e.team && `· ${e.team} `}· {day.format(new Date(e.submittedAt))}, week of{" "}
                        {formatWeekShort(e.weekStart)}
                      </span>
                      {e.note ? (
                        <p className="mt-1 max-w-[65ch]">{e.note}</p>
                      ) : e.hadPrivateNote ? (
                        <p className="mt-1 text-[12.5px] text-muted-foreground">Note kept private.</p>
                      ) : null}
                    </div>
                    <div className="col-start-2 flex gap-1.5 pt-1 sm:col-start-auto">
                      {INDICES.map((m) => {
                        const v = e.indices[m.key];
                        const b = bandOf(m.key, v)!;
                        return (
                          <span
                            key={m.key}
                            title={`${m.short}: ${v}`}
                            aria-label={`${m.short}: ${v}, ${BAND_LABEL[b].toLowerCase()}`}
                            role="img"
                            className={cn("inline-block size-2.5 rounded-full", BAND_DOT[b])}
                          />
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center text-muted-foreground">No check-ins match.</div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
