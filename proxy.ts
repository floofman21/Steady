import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Every app route needs a signed-in session. Pages still check the roster and
// role on the server (lib/viewer.ts, lib/permissions.ts); this is the first gate.
export default auth((req) => {
  if (req.auth) return NextResponse.next();
  const url = new URL("/sign-in", req.nextUrl.origin);
  if (req.nextUrl.pathname !== "/") url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  // Public: sign-in, first-run setup, Auth.js endpoints, cron (own secret), static assets.
  matcher: ["/((?!sign-in|setup|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
