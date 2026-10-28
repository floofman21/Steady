"use client";

import { BAND_LABEL, BAND_TEXT, bandOf } from "@/components/shared/index-style";
import { TrendChart } from "@/components/shared/trend-chart";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { PersonDetail } from "@/lib/dashboard";
import { INDICES } from "@/lib/scoring";
import { cn, initials } from "@/lib/utils";
import { formatWeekShort } from "@/lib/week";
import { useUrlParams } from "./use-url-params";

export function PersonDrawer({ person }: { person: PersonDetail | null }) {
  const { update } = useUrlParams();
  return (
    <Sheet open={Boolean(person)} onOpenChange={(open) => !open && update({ person: null })}>
      <SheetContent side="right" className="px-[22px] pt-5 pb-6">
        {person && (
          <>
            <div className="mb-[18px] flex items-center gap-3 pr-10">
              <span className="grid size-11 flex-none place-items-center rounded-full bg-brand-soft text-[15px] font-semibold text-brand">
                {initials(person.name)}
              </span>
              <div className="min-w-0">
                <SheetTitle>{person.name}</SheetTitle>
                <SheetDescription className="text-[13px]">
                  <span className="font-mono text-[12.5px]">{person.employeeCode}</span>
                  {person.team && ` · ${person.team}`}
                  {person.department && `, ${person.department}`}
                </SheetDescription>
              </div>
            </div>

            {person.current ? (
              <dl className="mb-[18px] grid grid-cols-2 gap-2.5">
                {INDICES.map((m) => {
                  const v = person.current![m.key];
                  const b = bandOf(m.key, v)!;
                  return (
                    <div key={m.key} className="rounded-md border border-border px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">{m.short}</dt>
                      <dd className="m-0 flex items-baseline justify-between gap-2">
                        <b className={cn("num font-display text-[22px] font-semibold", BAND_TEXT[b])}>{v}%</b>
                        <span className={cn("text-[11px] font-semibold", BAND_TEXT[b])}>{BAND_LABEL[b]}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="mb-4 text-muted-foreground">No check-ins in the last 8 weeks.</p>
            )}

            <Section>Last 8 weeks</Section>
            <TrendChart points={person.series} />

            <Section>Participation</Section>
            <p>
              <span className="num">{person.completed}</span> of <span className="num">{person.series.length}</span>{" "}
              weekly check-ins completed
              {person.missedThisWeek && person.lastWeek
                ? `. Last one was the week of ${formatWeekShort(person.lastWeek)}.`
                : "."}
            </p>

            <Section>Shared notes</Section>
            {person.notes.length ? (
              <div className="flex flex-col gap-2">
                {person.notes.map((n) => (
                  <figure key={n.weekStart} className="m-0 rounded-md bg-sunk p-3">
                    <figcaption className="text-xs text-muted-foreground">Week of {formatWeekShort(n.weekStart)}</figcaption>
                    <blockquote className="m-0 mt-0.5">{n.note}</blockquote>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No notes shared with managers.</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 mb-2 text-[11px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">{children}</h3>
  );
}
