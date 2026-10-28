"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData } from "@/lib/dashboard";
import { INDICES, type Indices } from "@/lib/scoring";
import { BandLegend, METRIC_ICON, StatusDot } from "./metric";
import { useUrlParams } from "./use-url-params";

type Props = { breakdown: DashboardData["breakdown"]; individual: boolean; minGroupSize: number };

export function Breakdown({ breakdown, individual, minGroupSize }: Props) {
  const { update } = useUrlParams();
  const [tab, setTab] = React.useState(individual ? "attention" : "team");

  const filterTable = (changes: Record<string, string | null>) => {
    update({ ...changes, page: null });
    document.getElementById("people")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const note = {
    attention: `${breakdown.needsAttention.length} ${breakdown.needsAttention.length === 1 ? "person" : "people"} with high burnout or low happiness`,
    team: `Average of each member’s latest check-in · shown at ${minGroupSize}+ responses`,
    department: `Average of each member’s latest check-in · shown at ${minGroupSize}+ responses`,
  }[tab];

  return (
    <Card className="flex min-w-0 flex-col">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">Breakdown</h2>
            <p className="text-[12.5px] text-muted-foreground">{note}</p>
          </div>
          <TabsList aria-label="Breakdown by">
            {individual && <TabsTrigger value="attention">Needs attention</TabsTrigger>}
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="department">Department</TabsTrigger>
          </TabsList>
        </div>

        <div className="max-h-[332px] flex-1 overflow-auto">
          {individual && (
            <TabsContent value="attention">
              {breakdown.needsAttention.length ? (
                <MiniTable first="Employee">
                  {breakdown.needsAttention.map((p) => (
                    <Row
                      key={p.id}
                      label={p.name}
                      sub={[p.team, p.department].filter(Boolean).join(" · ")}
                      indices={p.indices}
                      onSelect={() => update({ person: p.id })}
                      action={`Open ${p.name}`}
                    />
                  ))}
                </MiniTable>
              ) : (
                <Empty>Nobody is flagged right now.</Empty>
              )}
            </TabsContent>
          )}
          {(["team", "department"] as const).map((kind) => {
            const rows = kind === "team" ? breakdown.teams : breakdown.departments;
            return (
              <TabsContent key={kind} value={kind}>
                {rows.length ? (
                  <MiniTable first={kind === "team" ? "Team" : "Department"}>
                    {rows.map((r) => (
                      <Row
                        key={r.id}
                        label={r.name}
                        sub={
                          <>
                            {r.sub ? `${r.sub} · ` : ""}
                            {r.members} {r.members === 1 ? "person" : "people"}
                            {r.atRisk > 0 && individual && <span className="text-bad"> · {r.atRisk} at risk</span>}
                          </>
                        }
                        indices={r.indices}
                        hidden={!r.indices}
                        hiddenNote="Not enough responses to display"
                        onSelect={() => filterTable(kind === "team" ? { q: r.name, dept: null } : { dept: r.name, q: null })}
                        action={`Show ${r.name} in the table`}
                      />
                    ))}
                  </MiniTable>
                ) : (
                  <Empty>No {kind === "team" ? "teams" : "departments"} yet.</Empty>
                )}
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
      <BandLegend />
    </Card>
  );
}

function MiniTable({ first, children }: { first: string; children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="border-b border-border px-4 py-2.5 text-left text-[12.5px] font-medium text-muted-foreground">
            {first}
          </th>
          {INDICES.map((m) => {
            const Icon = METRIC_ICON[m.key];
            return (
              <th key={m.key} className="w-14 border-b border-border py-2.5 text-center text-muted-foreground">
                <Icon className="mx-auto size-[15px]" strokeWidth={1.8} aria-label={m.short} />
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Row({
  label,
  sub,
  indices,
  hidden,
  hiddenNote,
  onSelect,
  action,
}: {
  label: string;
  sub: React.ReactNode;
  indices: Indices | null;
  hidden?: boolean;
  hiddenNote?: string;
  onSelect: () => void;
  action: string;
}) {
  return (
    <tr className="group cursor-pointer border-b border-border last:border-0 hover:bg-sunk" onClick={onSelect}>
      <td className="px-4 py-2.5">
        <button
          type="button"
          className="text-left font-normal"
          aria-label={action}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {label}
        </button>
        <small className="block text-xs text-muted-foreground">{sub}</small>
      </td>
      {hidden ? (
        <td colSpan={4} className="px-4 py-2.5 text-center text-xs text-muted-foreground">
          {hiddenNote}
        </td>
      ) : (
        INDICES.map((m) => (
          <td key={m.key} className="w-14 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <StatusDot metric={m.key} value={indices?.[m.key] ?? null} />
          </td>
        ))
      )}
    </tr>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-muted-foreground">{children}</div>;
}
