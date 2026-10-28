import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Resend from "next-auth/providers/resend";

// The database-free part of the Auth.js config. proxy.ts uses only this (it just
// verifies the session token); auth.ts adds the adapter and the roster check.

/** Providers are enabled by their env vars, so an instance can run with any subset. */
export function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);
  if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
    providers.push(MicrosoftEntraID);
  }
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    // Email magic link, mainly for testing.
    providers.push(Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM }));
  }
  return providers;
}

export const authConfig = {
  // JWT sessions so proxy.ts can check them without a database round trip.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  providers: configuredProviders(),
  pages: { signIn: "/sign-in", error: "/sign-in", verifyRequest: "/sign-in?check-email=1" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.email) token.email = user.email.toLowerCase();
      return token;
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
} satisfies NextAuthConfig;
