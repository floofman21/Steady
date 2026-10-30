"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { IMPORT_COLUMNS, type RowResult } from "@/lib/roster-import";

type Summary = { total: number; valid: number; invalid: number; create: number; update: number; unchanged: number };
type Preview = { summary: Summary; errors: RowResult[] };

const TEMPLATE = [
  IMPORT_COLUMNS.join(","),
  "EMP-1001,Jordan Lee,jordan.lee@yourcompany.com,Engineering,Platform,,manager",
  "EMP-1002,Sam Patel,sam.patel@yourcompany.com,Engineering,Platform,jordan.lee@yourcompany.com,employee",
].join("\n");

async function send(file: File, commit: boolean) {
  const body = new FormData();
  body.set("file", file);
  if (commit) body.set("commit", "true");
  const res = await fetch("/api/admin/import", { method: "POST", body });
  const json = await res.json().catch(() => ({ error: "The server sent an unexpected response." }));
  return { ok: res.ok, json };
}

export function ImportSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"preview" | "commit" | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const choose = async (f: File | null) => {
    reset();
    if (!f) return;
    setFile(f);
    setBusy("preview");
    const { ok, json } = await send(f, false);
    setBusy(null);
    if (ok) setPreview(json as Preview);
    else setError(json.error ?? "Couldn’t read that file.");
  };

  const commit = async () => {
    if (!file) return;
    setBusy("commit");
    const { ok, json } = await send(file, true);
    setBusy(null);
    if (!ok) {
      setError(json.error ?? "The import failed and nothing was changed.");
      return;
    }
    const r = json.result as { created: number; updated: number; teamsCreated: number };
    toast(
      `Imported: ${r.created} added, ${r.updated} updated` + (r.teamsCreated ? `, ${r.teamsCreated} new teams` : "") + ".",
    );
    setOpen(false);
    reset();
    router.refresh();
  };

  const s = preview?.summary;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload /> Import CSV
      </Button>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <SheetContent side="right" className="max-w-[560px] px-[22px] pt-5 pb-6">
          <SheetTitle className="mb-1 pr-10">Import roster</SheetTitle>
          <SheetDescription className="mb-4 text-[13px]">
            Upload a CSV with the columns below. People are matched by employee ID: new IDs are added, existing ones
            updated. Departments and teams are created as needed. Nothing changes until you confirm.
          </SheetDescription>

          <code className="mb-2 block overflow-x-auto rounded-md bg-sunk px-3 py-2 font-mono text-[12px] whitespace-nowrap">
            {IMPORT_COLUMNS.join(",")}
          </code>
          <p className="mb-4 text-[13px] text-muted-foreground">
            role is employee, manager or hr_admin. manager_email is optional and sets the team’s manager.{" "}
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
              download="steady-roster-template.csv"
              className="inline-flex items-center gap-1 font-semibold text-brand"
            >
              <Download className="size-3.5" /> Template
            </a>
          </p>

          <label className="mb-4 flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center hover:bg-sunk">
            <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold">{file ? file.name : "Choose a CSV file"}</span>
            <span className="text-xs text-muted-foreground">Up to 5,000 rows</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="CSV file"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
          </label>

          {busy === "preview" && <p className="text-muted-foreground">Checking the file…</p>}
          {error && (
            <p role="alert" className="mb-4 rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">
              {error}
            </p>
          )}

          {s && (
            <div aria-live="polite">
              <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat label="Rows" value={s.total} />
                <Stat label="New" value={s.create} />
                <Stat label="Updated" value={s.update} />
                <Stat label="With errors" value={s.invalid} tone={s.invalid ? "bad" : undefined} />
              </div>

              {preview!.errors.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-bad">
                    <CircleAlert className="size-4" aria-hidden="true" />
                    {s.invalid} {s.invalid === 1 ? "row needs" : "rows need"} fixing
                  </h3>
                  <div className="max-h-72 overflow-auto rounded-md border border-border">
                    <table className="w-full border-collapse text-[13px]">
                      <thead className="sticky top-0 bg-surface">
                        <tr className="text-left text-muted-foreground">
                          <th className="border-b border-border px-3 py-2 font-medium">Line</th>
                          <th className="border-b border-border px-3 py-2 font-medium">Employee ID</th>
                          <th className="border-b border-border px-3 py-2 font-medium">Problem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview!.errors.map((r) => (
                          <tr key={r.line} className="border-b border-border align-top last:border-0">
                            <td className="num px-3 py-2">{r.line}</td>
                            <td className="px-3 py-2 font-mono text-[12px]">{r.values.employee_code || "—"}</td>
                            <td className="px-3 py-2">{r.errors.join(". ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fix these in your file and choose it again, or import the other rows now and skip these.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button variant="outline" onClick={reset} disabled={busy !== null}>
                  Cancel
                </Button>
                <Button onClick={commit} disabled={busy !== null || s.valid === 0}>
                  {busy === "commit"
                    ? "Importing…"
                    : s.valid === 0
                      ? "Nothing to import"
                      : `Import ${s.valid} ${s.valid === 1 ? "row" : "rows"}${s.invalid ? `, skip ${s.invalid}` : ""}`}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className="rounded-md bg-sunk px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`num font-display text-xl font-semibold ${tone === "bad" ? "text-bad" : ""}`}>{value}</div>
    </div>
  );
}
