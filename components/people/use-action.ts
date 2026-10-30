"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/(app)/admin/people/actions";

/** Runs a server action in a transition and reports the result as a toast. */
export function useAction() {
  const [pending, start] = React.useTransition();
  const run = React.useCallback((action: () => Promise<ActionResult>) => {
    start(async () => {
      const r = await action();
      if (r.ok) toast(r.message);
      else toast.error(r.error);
    });
  }, []);
  return { pending, run };
}
