"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { BAND_TEXT, bandOf } from "@/components/shared/index-style";
import { Card } from "@/components/ui/card";
import { DIRECTION, type IndexKey } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { METRIC, METRIC_ICON } from "./metric";

const BAND_VAR = { healthy: "var(--good)", watch: "var(--warn)", at_risk: "var(--bad)" } as const;

export function KpiCard({
  metric,
  value,
  delta,
  series,
}: {
  metric: IndexKey;
  value: number | null;
  delta: number | null;
  series: (number | null)[];
}) {
  const m = METRIC[metric];
  const Icon = METRIC_ICON[metric];
  const band = bandOf(metric, value == null ? null : Math.round(value));
  const better = delta != null && (DIRECTION[metric] === "higher" ? delta > 0 : delta < 0);
  const flat = delta == null || Math.abs(delta) < 0.05;
  const color = band ? BAND_VAR[band] : "var(--faint)";
  const data = series.map((v, i) => ({ i, v }));
  const values = series.filter((v): v is number => v != null);

  return (
    <Card className="flex min-w-0 flex-col justify-between gap-3 px-[18px] pt-[18px] pb-3.5">
      <div className="flex items-center gap-2 font-medium text-muted-foreground">
        <Icon className="size-4 flex-none" strokeWidth={1.8} aria-hidden="true" />
        <span>{m.label}</span>
        <span className="ml-auto text-[11px] tracking-[0.06em] whitespace-nowrap text-faint uppercase">
          {m.direction === "lower" ? "lower" : "higher"} is better
        </span>
      </div>
      <div className="flex items-end justify-between gap-2.5">
        <div>
          <div
            className={cn(
              "num mt-1.5 font-display text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[34px]",
              band && BAND_TEXT[band],
            )}
          >
            {value == null ? "–" : `${value.toFixed(1)}%`}
          </div>
          <div className="text-[12.5px] text-muted-foreground">
            {value == null ? (
              "Not enough responses to display"
            ) : delta == null ? (
              "No data for last week"
            ) : (
              <>
                <b className={cn("num font-semibold", !flat && (better ? "text-good" : "text-bad"))}>
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)} pts
                </b>
                <span className="sr-only">{flat ? ", unchanged" : better ? ", better" : ", worse"}</span> vs last
                week
              </>
            )}
          </div>
        </div>
        {values.length > 1 && (
          <div className="h-[34px] w-24 flex-none" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 3, right: 3, bottom: 0, left: 3 }}>
                <YAxis hide domain={[Math.min(...values) - 4, Math.max(...values) + 4]} />
                <Area
                  type="linear"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={1.6}
                  fill={color}
                  fillOpacity={0.12}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
