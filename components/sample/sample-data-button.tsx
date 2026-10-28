"use client";

import * as React from "react";
import { toast } from "sonner";
import { loadSampleDataAction, removeSampleDataAction } from "@/app/(app)/admin/sample-actions";
import { Button } from "@/components/ui/button";

export function SampleDataButton({ mode, variant = "outline" }: { mode: "load" | "remove"; variant?: "outline" | "default" | "link" }) {
  const [pending, start] = React.useTransition();
  const run = () =>
    start(async () => {
      if (mode === "remove" && !confirm("Remove all sample people and their check-ins? Your real data stays.")) return;
      const r = await (mode === "load" ? loadSampleDataAction() : removeSampleDataAction());
      if (r.ok) toast(r.message);
      else toast.error(r.error);
    });
  return (
    <Button type="button" variant={variant} onClick={run} disabled={pending}>
      {pending ? (mode === "load" ? "Adding sample data…" : "Removing…") : mode === "load" ? "Load sample data" : "Remove sample data"}
    </Button>
  );
}
