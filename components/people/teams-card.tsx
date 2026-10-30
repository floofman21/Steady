"use client";

import * as React from "react";
import { toast } from "sonner";
import { addTeam, setTeamManager, type ActionResult } from "@/app/(app)/admin/people/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Roster } from "@/lib/roster";
import { useAction } from "./use-action";

export function TeamsCard({ roster }: { roster: Roster }) {
  const { pending, run } = useAction();
  const managers = roster.people.filter((p) => p.active && (p.role === "manager" || p.role === "hr_admin"));
  const departments = [...new Set(roster.teams.map((t) => t.department))];
  const [state, action, adding] = React.useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const r = await addTeam(prev, fd);
    if (r.ok) toast(r.message);
    return r;
  }, null);

  return (
    <section aria-labelledby="teams-heading" className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="teams-heading" className="font-display text-lg font-semibold">
          Teams
        </h2>
        <p className="text-[13px] text-muted-foreground">A team’s manager sees its members on their dashboard.</p>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="text-left text-[13px] text-muted-foreground">
                {["Department", "Team", "Members", "Manager"].map((h) => (
                  <th key={h} className="border-b border-border px-3.5 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.teams.map((t) => (
                <tr key={t.id} className="border-b border-border">
                  <td className="px-3.5 py-2.5 text-muted-foreground">{t.department}</td>
                  <td className="px-3.5 py-2.5 font-medium">{t.name}</td>
                  <td className="num px-3.5 py-2.5">{t.members}</td>
                  <td className="px-3.5 py-2.5">
                    <select
                      key={`mgr-${t.managerId}`}
                      aria-label={`Manager of ${t.name}`}
                      defaultValue={t.managerId ?? ""}
                      disabled={pending}
                      onChange={(e) => run(() => setTeamManager({ teamId: t.id, managerId: e.target.value || null }))}
                      className="h-8 max-w-[220px] rounded-md border border-border bg-surface px-2 text-[13px]"
                    >
                      <option value="">No manager</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="px-3.5 py-3">
                  <form action={action} className="flex flex-wrap items-center gap-2">
                    <input
                      name="department"
                      required
                      list="department-names"
                      placeholder="Department"
                      aria-label="New team’s department"
                      className="h-8 w-44 rounded-md border border-border bg-surface px-2.5 text-[13px] placeholder:text-faint"
                    />
                    <datalist id="department-names">
                      {departments.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                    <input
                      name="team"
                      required
                      placeholder="Team name"
                      aria-label="New team’s name"
                      className="h-8 w-44 rounded-md border border-border bg-surface px-2.5 text-[13px] placeholder:text-faint"
                    />
                    <Button type="submit" size="sm" variant="outline" disabled={adding}>
                      Add team
                    </Button>
                    {state && !state.ok && <span className="text-[13px] text-bad">{state.error}</span>}
                  </form>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
