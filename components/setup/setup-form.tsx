"use client";

import * as React from "react";
import { createOrganization, type SetupState } from "@/app/(auth)/setup/actions";
import { Button } from "@/components/ui/button";

const input =
  "h-10 w-full rounded-md border border-border bg-surface px-3 placeholder:text-faint aria-invalid:border-bad";

export function SetupForm({ timezones }: { timezones: string[] }) {
  const [state, action, pending] = React.useActionState<SetupState, FormData>(createOrganization, {});
  // Default to the browser's time zone once it's known on the client.
  const [timezone, setTimezone] = React.useState("America/New_York");
  React.useEffect(() => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after hydration
    if (timezones.includes(local)) setTimezone(local);
  }, [timezones]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Organization name" htmlFor="orgName">
        <input id="orgName" name="orgName" required autoComplete="organization" className={input} />
      </Field>
      <Field label="Time zone" htmlFor="timezone" hint="Weeks start Monday in this time zone.">
        <select
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={input}
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </Field>
      <div className="my-1 h-px bg-border" />
      <Field label="Your name" htmlFor="name">
        <input id="name" name="name" required autoComplete="name" className={input} />
      </Field>
      <Field label="Work email" htmlFor="email" hint="Use the address you’ll sign in with.">
        <input id="email" name="email" type="email" required autoComplete="email" className={input} />
      </Field>
      <Field label="Employee ID" htmlFor="employeeCode" hint="Optional. Defaults to EMP-0001.">
        <input id="employeeCode" name="employeeCode" placeholder="EMP-0001" className={`${input} font-mono`} />
      </Field>

      {state.error && (
        <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Setting up…" : "Create organization"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
      </label>
      {children}
      {hint && <small className="text-xs text-muted-foreground">{hint}</small>}
    </div>
  );
}
