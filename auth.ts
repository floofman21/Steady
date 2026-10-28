import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { emailDomainAllowed } from "@/lib/auth-rules";
import { getDb, schema } from "@/lib/db";

export { configuredProviders } from "@/auth.config";

async function onRoster(email: string) {
  const [row] = await getDb()
    .select({ id: schema.people.id })
    .from(schema.people)
    .where(and(eq(schema.people.email, email.toLowerCase()), eq(schema.people.active, true)))
    .limit(1);
  return Boolean(row);
}

// Lazy config: the adapter and database are only touched when a request needs auth.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  callbacks: {
    ...authConfig.callbacks,
    // Runs before any user row is created, so rejected sign-ins create nothing.
    async signIn({ user, profile }) {
      const email = (user.email ?? profile?.email ?? "").toLowerCase();
      if (!email) return "/sign-in?error=NoEmail";
      if (!emailDomainAllowed(email)) return "/sign-in?error=DomainNotAllowed";
      if (!(await onRoster(email))) return "/sign-in?error=NotOnRoster";
      return true;
    },
  },
}));
