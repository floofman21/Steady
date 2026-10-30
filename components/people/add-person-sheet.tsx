"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addPerson, type ActionResult } from "@/app/(app)/admin/people/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Roster } from "@/lib/roster";

const input = "h-10 w-full rounded-md border border-border bg-surface px-3 placeholder:text-faint";

export function AddPersonSheet({ teams }: { teams: Roster["teams"] }) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = React.useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const r = await addPerson(prev, fd);
    if (r.ok) {
      toast(r.message);
      setOpen(false);
    }
    return r;
  }, null);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus /> Add person
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="px-[22px] pt-5 pb-6">
          <SheetTitle className="mb-1 pr-10">Add a person</SheetTitle>
          <SheetDescription className="mb-5 text-[13px]">
            They can sign in with this email straight away. To add many people at once, use Import CSV.
          </SheetDescription>
          <form action={action} className="flex flex-col gap-4">
            <Field label="Name" id="p-name">
              <input id="p-name" name="name" required className={input} />
            </Field>
            <Field label="Work email" id="p-email">
              <input id="p-email" name="email" type="email" required className={input} />
            </Field>
            <Field label="Employee ID" id="p-code">
              <input id="p-code" name="employeeCode" required placeholder="EMP-1001" className={`${input} font-mono`} />
            </Field>
            <Field label="Team" id="p-team">
              <select id="p-team" name="teamId" defaultValue="" className={input}>
                <option value="">No team yet</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.department} · {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Role" id="p-role">
              <select id="p-role" name="role" defaultValue="employee" className={input}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr_admin">HR admin</option>
              </select>
            </Field>
            {state && !state.ok && (
              <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add person"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
