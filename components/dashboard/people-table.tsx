"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DashboardData } from "@/lib/dashboard";
import { PER_PAGE, type DashboardParams, type SortKey } from "@/lib/dashboard-params";
import { INDICES } from "@/lib/scoring";
import { cn, initials } from "@/lib/utils";
import { formatWeekShort } from "@/lib/week";
import { StatusDot } from "./metric";
import { useUrlParams } from "./use-url-params";

type ColumnKey = "id" | "dept" | "burnout" | "happiness" | "stress" | "engagement" | "last";
const COLUMNS: { key: ColumnKey; label: string; sort: SortKey }[] = [
  { key: "id", label: "Employee ID", sort: "id" },
  { key: "dept", label: "Department", sort: "dept" },
  ...INDICES.map((m) => ({ key: m.key as ColumnKey, label: m.short, sort: m.key as SortKey })),
  { key: "last", label: "Last check-in", sort: "last" },
];
const ALL_ON = Object.fromEntries(COLUMNS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>;

const control =
  "h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-sunk focus-visible:outline-2";

type Props = {
  table: DashboardData["table"];
  params: DashboardParams;
  departments: string[];
  individual: boolean;
  /** Column choice is remembered per signed-in person in this browser. */
  storageKey: string;
};

export function PeopleTable({ table, params, departments, individual, storageKey }: Props) {
  const { update, pending } = useUrlParams();
  const [query, setQuery] = React.useState(params.q);
  const [selected, setSelected] = React.useState<Map<string, string>>(new Map());
  const cols = useStoredColumns(storageKey);

  // Keep the box in sync when the URL changes elsewhere (e.g. clicking a team in the breakdown).
  const [lastQ, setLastQ] = React.useState(params.q);
  if (params.q !== lastQ) {
    setLastQ(params.q);
    setQuery(params.q);
  }

  // Debounce typing into the URL.
  React.useEffect(() => {
    if (query === params.q) return;
    const t = setTimeout(() => update({ q: query, page: null }), 250);
    return () => clearTimeout(t);
  }, [query, params.q, update]);

  const visibleCols = COLUMNS.filter(
    (c) => cols.value[c.key] && (individual || !INDICES.some((m) => m.key === c.key)),
  );
  const pageIds = table.rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggle = (id: string, name: string, on: boolean) =>
    setSelected((s) => {
      const next = new Map(s);
      if (on) next.set(id, name);
      else next.delete(id);
      return next;
    });

  const sortBy = (key: SortKey) => {
    const dir = params.sort === key ? (params.dir === "asc" ? "desc" : "asc") : undefined;
    update({ sort: key, dir: dir ?? null, page: null });
  };

  const copyNames = async () => {
    const names = [...selected.values()].join(", ");
    try {
      await navigator.clipboard.writeText(names);
      toast(`Copied ${selected.size} ${selected.size === 1 ? "name" : "names"}`);
    } catch {
      toast(`Copy blocked here: ${names}`);
    }
  };

  const hasFilters = Boolean(params.q || params.dept || params.risk);

  return (
    <section id="people" className="scroll-mt-4" aria-label="Employees">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[380px] min-w-0 flex-[1_1_240px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID or team…"
            aria-label="Search employees"
            className="h-9 w-full rounded-md border border-border bg-surface pr-3 pl-9 placeholder:text-faint"
          />
        </div>
        <select
          value={params.dept}
          onChange={(e) => update({ dept: e.target.value, page: null })}
          aria-label="Department"
          className={control}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={params.risk}
          onClick={() => update({ risk: !params.risk, page: null })}
          className={cn(
            control,
            "inline-flex items-center gap-2",
            params.risk && "border-transparent bg-bad-soft text-bad hover:bg-bad-soft",
          )}
        >
          <span className="size-2.5 rounded-full bg-bad" aria-hidden="true" />
          At risk only
        </button>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(control, "inline-flex items-center gap-1.5")}>
            Columns <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COLUMNS.filter((c) => individual || !INDICES.some((m) => m.key === c.key)).map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={cols.value[c.key]}
                onCheckedChange={(on) => cols.set({ ...cols.value, [c.key]: on === true })}
                onSelect={(e) => e.preventDefault()}
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className={cn("overflow-hidden transition-opacity", pending && "opacity-70")}>
        <div className="overflow-x-auto">
          {table.rows.length ? (
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <th className="w-11 border-b border-border py-3 pl-3.5">
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      onChange={(e) => table.rows.forEach((r) => toggle(r.id, r.name, e.target.checked))}
                      aria-label="Select all on this page"
                      className="size-4 accent-[var(--accent-base)]"
                    />
                  </th>
                  <SortHeader label="Employee Name" sortKey="name" params={params} onSort={sortBy} />
                  {visibleCols.map((c) => (
                    <SortHeader key={c.key} label={c.label} sortKey={c.sort} params={params} onSort={sortBy} />
                  ))}
                  {!individual && <th className="border-b border-border px-3.5 py-3 text-left text-[13px] font-medium text-muted-foreground">Status</th>}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => {
                  const isSel = selected.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      onClick={individual ? () => update({ person: r.id }) : undefined}
                      className={cn(
                        "border-b border-border last:border-0",
                        individual && "cursor-pointer",
                        isSel ? "bg-brand-soft" : "hover:bg-sunk",
                      )}
                    >
                      <td className="py-[11px] pl-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={(e) => toggle(r.id, r.name, e.target.checked)}
                          aria-label={`Select ${r.name}`}
                          className="size-4 accent-[var(--accent-base)]"
                        />
                      </td>
                      <td className="px-3.5 py-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-7 flex-none place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                            {initials(r.name)}
                          </span>
                          {individual ? (
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                update({ person: r.id });
                              }}
                            >
                              {r.name}
                            </button>
                          ) : (
                            r.name
                          )}
                        </div>
                      </td>
                      {visibleCols.map((c) => (
                        <td key={c.key} className="px-3.5 py-[11px] whitespace-nowrap">
                          {c.key === "id" ? (
                            <span className="font-mono text-[12.5px]">{r.employeeCode}</span>
                          ) : c.key === "dept" ? (
                            (r.department ?? "—")
                          ) : c.key === "last" ? (
                            <>
                              {r.lastWeek ? formatWeekShort(r.lastWeek) : "Never"}
                              {r.missedThisWeek && <span className="text-xs text-bad"> · missed this week</span>}
                            </>
                          ) : (
                            <span onClick={(e) => e.stopPropagation()}>
                              <StatusDot metric={c.key} value={r.indices?.[c.key] ?? null} showValue />
                            </span>
                          )}
                        </td>
                      ))}
                      {!individual && (
                        <td className="px-3.5 py-[11px] whitespace-nowrap">
                          {r.atRisk ? (
                            <span className="rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-semibold text-bad">At risk</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-10 text-center text-muted-foreground">
              No employees match these filters.{" "}
              {hasFilters && (
                <button
                  type="button"
                  className="font-semibold text-brand"
                  onClick={() => {
                    setQuery("");
                    update({ q: null, dept: null, risk: null, page: null });
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-0.5 pt-3 text-[13px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num" aria-live="polite">
            {selected.size} of {table.total} row(s) selected
          </span>
          {selected.size > 0 && (
            <>
              <button type="button" className="font-semibold text-brand" onClick={copyNames}>
                Copy names
              </button>
              <button type="button" className="font-semibold text-brand" onClick={() => setSelected(new Map())}>
                Clear
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="per">Rows per page</label>
          <select
            id="per"
            value={params.per}
            onChange={(e) => update({ per: e.target.value === "10" ? null : e.target.value, page: null })}
            className="h-8 rounded-md border border-border bg-surface px-2"
          >
            {PER_PAGE.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <span className="num px-1">
            Page {table.page} of {table.pages}
          </span>
          <PageButton label="First page" disabled={table.page <= 1} onClick={() => update({ page: null })}>
            <ChevronsLeft className="size-4" />
          </PageButton>
          <PageButton label="Previous page" disabled={table.page <= 1} onClick={() => update({ page: table.page - 1 > 1 ? table.page - 1 : null })}>
            <ChevronLeft className="size-4" />
          </PageButton>
          <PageButton label="Next page" disabled={table.page >= table.pages} onClick={() => update({ page: table.page + 1 })}>
            <ChevronRight className="size-4" />
          </PageButton>
          <PageButton label="Last page" disabled={table.page >= table.pages} onClick={() => update({ page: table.pages })}>
            <ChevronsRight className="size-4" />
          </PageButton>
        </div>
      </div>
    </section>
  );
}

function SortHeader({
  label,
  sortKey,
  params,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  params: DashboardParams;
  onSort: (k: SortKey) => void;
}) {
  const active = params.sort === sortKey;
  return (
    <th
      aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : "none"}
      className="border-b border-border px-3.5 py-3 text-left text-[13px] font-medium whitespace-nowrap text-muted-foreground"
    >
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 hover:text-foreground">
        {label}
        {active &&
          (params.dir === "asc" ? (
            <ArrowUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden="true" />
          ))}
      </button>
    </th>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-[7px] border border-border bg-surface text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function useStoredColumns(storageKey: string) {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const onStorage = (e: StorageEvent) => e.key === storageKey && cb();
      window.addEventListener("storage", onStorage);
      window.addEventListener(`local:${storageKey}`, cb);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(`local:${storageKey}`, cb);
      };
    },
    [storageKey],
  );
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const value = React.useMemo(() => {
    try {
      return raw ? { ...ALL_ON, ...(JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>) } : ALL_ON;
    } catch {
      return ALL_ON;
    }
  }, [raw]);
  const set = (next: Record<ColumnKey, boolean>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage blocked (private mode): column choices can’t be saved.
    }
    window.dispatchEvent(new Event(`local:${storageKey}`));
  };
  return { value, set };
}
