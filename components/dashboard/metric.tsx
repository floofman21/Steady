"use client";

import { Activity, Flame, Heart, Network, type LucideIcon } from "lucide-react";
import { BAND_DOT, BAND_LABEL, bandOf } from "@/components/shared/index-style";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INDICES, type IndexKey } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const METRIC_ICON: Record<IndexKey, LucideIcon> = {
  burnout: Flame,
  happiness: Heart,
  stress: Activity,
  engagement: Network,
};

export const METRIC = Object.fromEntries(INDICES.map((m) => [m.key, m])) as Record<IndexKey, (typeof INDICES)[number]>;

/** Status dot with its value in a tooltip; the band is also spelled out for screen readers. */
export function StatusDot({ metric, value, showValue = false }: { metric: IndexKey; value: number | null; showValue?: boolean }) {
  const band = bandOf(metric, value);
  const label = `${METRIC[metric].short}: ${value == null ? "no data" : `${value}, ${BAND_LABEL[band!].toLowerCase()}`}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-2" tabIndex={showValue ? undefined : 0} aria-label={label}>
          <span className={cn("inline-block size-2.5 flex-none rounded-full", band ? BAND_DOT[band] : "bg-border")} />
          {showValue && (
            <span className="num min-w-[2ch] text-[12.5px] text-muted-foreground" aria-hidden="true">
              {value ?? "–"}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function BandLegend() {
  return (
    <div className="flex flex-wrap gap-3.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      {(["healthy", "watch", "at_risk"] as const).map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <i className={cn("inline-block size-2.5 rounded-full", BAND_DOT[b])} />
          {BAND_LABEL[b]}
        </span>
      ))}
    </div>
  );
}
