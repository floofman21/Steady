import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { MailCheck } from "lucide-react";
import { auth, configuredProviders } from "@/auth";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSetUp } from "@/lib/setup";
import { getViewer } from "@/lib/viewer";
import { signInWith, signOutAction } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  NotOnRoster: "You’re not on Steady’s roster yet. Ask HR to add you to Steady.",
  DomainNotAllowed: "That email isn’t from an allowed domain. Sign in with your work account.",
  NoEmail: "Your account didn’t share an email address, so we couldn’t match it to the roster.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
};

type Search = { error?: string; callbackUrl?: string; "check-email"?: string; setup?: string };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  if (!(await isSetUp())) redirect("/setup");
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  const session = await auth();
  if (session?.user && (await getViewer())) redirect(callbackUrl.startsWith("/") ? callbackUrl : "/");
  // Signed in with an account that isn't (or is no longer) on the roster.
  const orphan = Boolean(session?.user);

  const providers = configuredProviders().map((p) => {
    const def = typeof p === "function" ? p() : p;
    return { id: def.id, name: def.name, type: def.type };
  });
  const oauth = providers.filter((p) => p.type !== "email");
  const email = providers.find((p) => p.type === "email");
  const error = orphan ? "NotOnRoster" : params.error;

  return (
    <main className="grid min-h-full place-items-center px-4 py-10">
      <Card className="w-full max-w-sm p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <Logo />
          <b className="font-display text-lg font-semibold">Steady</b>
        </div>

        {params["check-email"] ? (
          <>
            <MailCheck className="mb-3 size-7 text-brand" aria-hidden="true" />
            <h1 className="mb-1 font-display text-[22px] font-semibold">Check your email</h1>
            <p className="text-muted-foreground">We sent you a sign-in link. It expires in 24 hours.</p>
          </>
        ) : (
          <>
            <h1 className="mb-1 font-display text-[22px] font-semibold">Sign in</h1>
            <p className="mb-5 text-muted-foreground">
              {params.setup ? "Your organization is set up. Sign in with the work email you entered." : "Use your work account."}
            </p>

            {error && (
              <p role="alert" className="mb-4 rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">
                {ERRORS[error] ?? "Sign-in didn’t work. Try again."}
              </p>
            )}

            {orphan ? (
              <form action={signOutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  Sign out and use another account
                </Button>
              </form>
            ) : providers.length === 0 ? (
              <p className="rounded-md bg-sunk px-3 py-2.5 text-[13px] text-muted-foreground">
                Sign-in isn’t configured yet. An administrator needs to add Google, Microsoft or email sign-in
                settings to the deployment (see the README).
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {oauth.map((p) => (
                  <form key={p.id} action={signInWith.bind(null, p.id, callbackUrl)}>
                    <Button type="submit" variant="outline" className="h-11 w-full">
                      Continue with {p.name === "Microsoft Entra ID" ? "Microsoft" : p.name}
                    </Button>
                  </form>
                ))}
                {email && (
                  <>
                    {oauth.length > 0 && (
                      <div className="my-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        or
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <form action={signInWith.bind(null, email.id, callbackUrl)} className="flex flex-col gap-2">
                      <label htmlFor="email" className="text-[13px] font-semibold">
                        Email me a sign-in link
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        className="h-10 w-full rounded-md border border-border bg-surface px-3 placeholder:text-faint"
                      />
                      <Button type="submit" className="w-full">
                        Send link
                      </Button>
                    </form>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
