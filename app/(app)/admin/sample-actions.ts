"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isHrAdmin } from "@/lib/permissions";
import { hasSampleData } from "@/lib/queries";
import { insertSampleData, removeSampleData } from "@/lib/sample";
import { getViewer } from "@/lib/viewer";

export type SampleResult = { ok: true; message: string } | { ok: false; error: string };

async function requireHrAdmin() {
  const viewer = await getViewer();
  return viewer && isHrAdmin(viewer) ? viewer : null;
}

/** HR admin: adds the 42-person sample org (flagged is_sample) for exploring the dashboard. */
export async function loadSampleDataAction(): Promise<SampleResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return { ok: false, error: "Only HR admins can load sample data." };
  if (await hasSampleData(viewer.org.id)) return { ok: false, error: "Sample data is already loaded." };
  try {
    const r = await db.transaction((tx) =>
      insertSampleData(tx, { orgId: viewer.org.id, timezone: viewer.org.timezone, codePrefix: "SMP-" }),
    );
    revalidatePath("/", "layout");
    return { ok: true, message: `Added ${r.people} sample people with ${r.checkins} check-ins.` };
  } catch {
    return {
      ok: false,
      error: "Couldn’t add sample data. A department named like a sample one (e.g. Engineering) may already exist.",
    };
  }
}

/** HR admin: deletes every sample person, their check-ins, and the sample departments and teams. */
export async function removeSampleDataAction(): Promise<SampleResult> {
  const viewer = await requireHrAdmin();
  if (!viewer) return { ok: false, error: "Only HR admins can remove sample data." };
  const r = await db.transaction((tx) => removeSampleData(tx, viewer.org.id));
  revalidatePath("/", "layout");
  return { ok: true, message: `Removed ${r.people} sample people and their check-ins.` };
}
