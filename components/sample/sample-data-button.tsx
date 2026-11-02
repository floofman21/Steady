"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  loadSampleDataAction,
  refreshSampleDataAction,
  removeSampleDataAction,
} from "@/app/(app)/admin/sample-actions";
import { Button } from "@/components/ui/button";

const MODES = {
  load: { action: loadSampleDataAction, label: "Load sample data", busy: "Adding sample data…" },
  refresh: { action: refreshSampleDataAction, label: "Move it to this week", busy: "Refreshing…" },
  remove: { action: removeSampleDataAction, label: "Remove sample data", busy: "Removing…" },
} as const;

export function SampleDataButton({
  mode,
  variant = "outline",
}: {
  mode: keyof typeof MODES;
  variant?: "outline" | "default" | "link";
}) {
  const [pending, start] = React.useTransition();
  const run = () =>
    start(async () => {
      if (mode === "remove" && !confirm("Remove all sample people and their check-ins? Your real data stays.")) return;
      const r = await MODES[mode].action();
      if (r.ok) toast(r.message);
      else toast.error(r.error);
    });
  return (
    <Button type="button" variant={variant} onClick={run} disabled={pending}>
      {pending ? MODES[mode].busy : MODES[mode].label}
    </Button>
  );
}
