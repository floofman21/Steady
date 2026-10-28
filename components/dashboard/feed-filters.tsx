"use client";

import { cn } from "@/lib/utils";
import { useUrlParams } from "./use-url-params";

const control = "h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-sunk";

export function FeedFilters({ departments, dept, sharedOnly }: { departments: string[]; dept: string; sharedOnly: boolean }) {
  const { update } = useUrlParams();
  return (
    <div className="mb-3 flex flex-wrap gap-2.5">
      <select value={dept} onChange={(e) => update({ dept: e.target.value })} aria-label="Department" className={control}>
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d}>{d}</option>
        ))}
      </select>
      <button
        type="button"
        aria-pressed={sharedOnly}
        onClick={() => update({ shared: !sharedOnly })}
        className={cn(control, sharedOnly && "border-transparent bg-brand-soft text-brand hover:bg-brand-soft")}
      >
        With shared notes
      </button>
    </div>
  );
}
