import { NextResponse } from "next/server";
import { isHrAdmin } from "@/lib/permissions";
import { validateImport } from "@/lib/roster-import";
import { applyImport, existingRoster } from "@/lib/roster-import-apply";
import { getViewer } from "@/lib/viewer";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * POST multipart/form-data with `file` (CSV). Without `commit=true` it returns a preview with
 * row-level errors and writes nothing; with `commit=true` it applies the valid rows.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isHrAdmin(viewer)) return NextResponse.json({ error: "Only HR admins can import the roster." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a CSV file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The file is larger than 2 MB." }, { status: 413 });

  const preview = validateImport(await file.text(), await existingRoster(viewer.org.id), viewer.person.email);
  if (preview.headerError) return NextResponse.json({ error: preview.headerError }, { status: 400 });

  if (form?.get("commit") !== "true") {
    return NextResponse.json({
      summary: preview.summary,
      errors: preview.rows.filter((r) => r.errors.length),
      sample: preview.rows.filter((r) => !r.errors.length).slice(0, 20),
    });
  }

  if (!preview.valid.length) return NextResponse.json({ error: "No valid rows to import." }, { status: 400 });
  try {
    const result = await applyImport(viewer.org.id, preview.valid);
    return NextResponse.json({ summary: preview.summary, result });
  } catch (error) {
    console.error("[import] failed", error);
    // The import runs in one transaction, so a failure leaves the roster untouched.
    return NextResponse.json({ error: "The import failed and nothing was changed. Check the file and try again." }, { status: 500 });
  }
}
