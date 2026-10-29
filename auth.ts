import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, asc, eq } from "drizzle-orm";
import { authConfig } from "@/auth.config";
import { emailDomainAllowed } from "@/lib/auth-rules";
import { getDb, schema } from "@/lib/db";
import { ownerCodeEnabled, ownerCodeMatches } from "@/lib/owner-code";

export { configuredProviders } from "@/auth.config";

async function onRoster(email: string) {
  const [row] = await getDb()
    .select({ id: schema.people.id })
    .from(schema.people)
    .where(and(eq(schema.people.email, email.toLowerCase()), eq(schema.people.active, true)))
    .limit(1);
  return Boolean(row);
}

/** The first HR admin (the one created on /setup), for the owner access code. */
async function firstHrAdmin() {
  const [row] = await getDb()
    .select({ id: schema.people.id, name: schema.people.name, email: schema.people.email })
    .from(schema.people)
    .where(and(eq(schema.people.role, "hr_admin"), eq(schema.people.active, true)))
    .orderBy(asc(schema.people.createdAt))
    .limit(1);
  return row ?? null;
}

// Owner access code: a long secret in OWNER_ACCESS_CODE signs in as the first HR admin.
// A stopgap for getting in before Google, Microsoft or email sign-in is set up.
const ownerCode = Credentials({
  id: "owner-code",
  name: "Owner access code",
  credentials: { code: { label: "Access code", type: "password" } },
  async authorize(credentials) {
    if (!ownerCodeEnabled() || !ownerCodeMatches(String(credentials?.code ?? ""))) return null;
    const admin = await firstHrAdmin();
    return admin ? { id: admin.id, name: admin.name, email: admin.email } : null;
  },
});

// Lazy config: the adapter and database are only touched when a request needs auth.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  providers: ownerCodeEnabled() ? [...authConfig.providers, ownerCode] : authConfig.providers,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  callbacks: {
    ...authConfig.callbacks,
    // Runs before any user row is created, so rejected sign-ins create nothing.
    async signIn({ user, profile, account }) {
      const email = (user.email ?? profile?.email ?? "").toLowerCase();
      if (!email) return "/sign-in?error=NoEmail";
      // The owner code is set by whoever controls the deployment, so the domain rule doesn't apply.
      if (account?.provider !== "owner-code" && !emailDomainAllowed(email)) return "/sign-in?error=DomainNotAllowed";
      if (!(await onRoster(email))) return "/sign-in?error=NotOnRoster";
      return true;
    },
  },
}));
