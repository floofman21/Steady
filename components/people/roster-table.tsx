"use client";

import * as React from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { DropdownMenu as Menu } from "radix-ui";
import { deleteCheckins, setActive, updateRole, updateTeam } from "@/app/(app)/admin/people/actions";
import { Card } from "@/components/ui/card";
import type { Roster } from "@/lib/roster";
import { cn, initials } from "@/lib/utils";
import { useAction } from "./use-action";

const ROLE_LABEL = { employee: "Employee", manager: "Manager", hr_admin: "HR admin" } as const;
const select = "h-8 max-w-[200px] rounded-md border border-border bg-surface px-2 text-[13px] disabled:opacity-60";

export function RosterTable({ roster, viewerId }: { roster: Roster; viewerId: string }) {
  const [query, setQuery] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const { pending, run } = useAction();

  const byDept = React.useMemo(() => {
    const groups = new Map<string, Roster["teams"]>();
    for (const t of roster.teams) groups.set(t.department, [...(groups.get(t.department) ?? []), t]);
    return [...groups.entries()];
  }, [roster.teams]);

  const q = query.trim().toLowerCase();
  const people = roster.people.filter(
    (p) =>
      (showInactive || p.active) &&
      (!q || p.name.toLowerCase().includes(q) || p.email.includes(q) || p.employeeCode.toLowerCase().includes(q)),
  );
  const inactive = roster.people.filter((p) => !p.active).length;

  return (
    <section aria-label="Roster" className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[380px] min-w-0 flex-[1_1_240px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or ID…"
            aria-label="Search people"
            className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-9 placeholder:text-faint"
          />
        </div>
        {inactive > 0 && (
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="size-4 accent-[var(--accent-base)]"
            />
            Show {inactive} deactivated
          </label>
        )}
        <span className="num ml-auto text-[13px] text-muted-foreground">
          {roster.people.filter((p) => p.active).length} active
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="text-left text-[13px] text-muted-foreground">
                {["Person", "Employee ID", "Team", "Role", "Status", ""].map((h) => (
                  <th key={h} className="border-b border-border px-3.5 py-3 font-medium whitespace-nowrap">
                    {h || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const self = p.id === viewerId;
                return (
                  <tr key={p.id} className={cn("border-b border-border last:border-0", !p.active && "bg-sunk/60 text-muted-foreground")}>
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-7 flex-none place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                          {initials(p.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            {p.name}
                            {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                            {p.isSample && (
                              <span className="rounded-full bg-sunk px-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                Sample
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[12.5px] whitespace-nowrap">{p.employeeCode}</td>
                    <td className="px-3.5 py-2.5">
                      <select
                        key={`team-${p.teamId}`}
                        aria-label={`Team for ${p.name}`}
                        defaultValue={p.teamId ?? ""}
                        disabled={pending}
                        onChange={(e) => run(() => updateTeam({ personId: p.id, teamId: e.target.value || null }))}
                        className={select}
                      >
                        <option value="">No team</option>
                        {byDept.map(([dept, teams]) => (
                          <optgroup key={dept} label={dept}>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <select
                        key={`role-${p.role}`}
                        aria-label={`Role for ${p.name}`}
                        defaultValue={p.role}
                        disabled={pending || self}
                        title={self ? "You can’t change your own role" : undefined}
                        onChange={(e) => run(() => updateRole({ personId: p.id, role: e.target.value }))}
                        className={select}
                      >
                        {Object.entries(ROLE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {p.active ? (
                        <span className="rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">Active</span>
                      ) : (
                        <span className="rounded-full bg-sunk px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <Menu.Root>
                        <Menu.Trigger
                          aria-label={`Actions for ${p.name}`}
                          className="grid size-8 place-items-center rounded-[7px] text-muted-foreground hover:bg-sunk hover:text-foreground"
                        >
                          <MoreHorizontal className="size-4" />
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Content
                            align="end"
                            sideOffset={4}
                            className="z-50 min-w-[220px] rounded-lg border border-border bg-surface p-1.5 text-sm shadow-card"
                          >
                            {!self && (
                              <Menu.Item
                                onSelect={() => run(() => setActive({ personId: p.id, active: !p.active }))}
                                className="cursor-pointer rounded-[6px] px-2.5 py-[7px] outline-none data-[highlighted]:bg-sunk"
                              >
                                {p.active ? "Deactivate" : "Reactivate"}
                              </Menu.Item>
                            )}
                            <Menu.Item
                              disabled={p.checkins === 0}
                              onSelect={() => {
                                if (
                                  confirm(
                                    `Permanently delete all ${p.checkins} check-ins and notes by ${p.name}? This can’t be undone.`,
                                  )
                                ) {
                                  run(() => deleteCheckins({ personId: p.id }));
                                }
                              }}
                              className="cursor-pointer rounded-[6px] px-2.5 py-[7px] text-bad outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-bad-soft"
                            >
                              Delete check-ins ({p.checkins})…
                            </Menu.Item>
                          </Menu.Content>
                        </Menu.Portal>
                      </Menu.Root>
                    </td>
                  </tr>
                );
              })}
              {!people.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No one matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
