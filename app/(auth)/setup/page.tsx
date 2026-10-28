import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SetupForm } from "@/components/setup/setup-form";
import { Logo } from "@/components/shell/logo";
import { Card } from "@/components/ui/card";
import { isSetUp } from "@/lib/setup";

export const metadata: Metadata = { title: "Set up Steady" };

export default async function SetupPage() {
  await connection();
  if (await isSetUp()) redirect("/");

  return (
    <main className="grid min-h-full place-items-center px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <Logo />
          <b className="font-display text-lg font-semibold">Steady</b>
        </div>
        <h1 className="mb-1 font-display text-[24px] font-semibold tracking-[-0.01em]">Set up your organization</h1>
        <p className="mb-6 text-muted-foreground">
          You’ll be the first HR admin and sign in with the email below. You can add teams and people afterwards. This screen only appears once.
        </p>
        <SetupForm timezones={Intl.supportedValuesOf("timeZone")} />
      </Card>
    </main>
  );
}
