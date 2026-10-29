import { NextResponse, type NextRequest } from "next/server";

// Auth.js session cookie names (the __Secure- form is used over HTTPS; large tokens are chunked as .0, .1, …).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * First gate for app routes: signed-out visitors go to /sign-in.
 *
 * This is an optimistic check for a session cookie only. The session itself is verified on the
 * server by every page and action (lib/viewer.ts → auth()), together with the roster and role.
 * Keeping the proxy free of token decoding means it can never disagree with the pages about
 * whether someone is signed in, which is what causes redirect loops.
 */
export default function proxy(req: NextRequest) {
  const hasSession = req.cookies
    .getAll()
    .some(({ name }) => SESSION_COOKIES.some((base) => name === base || name.startsWith(`${base}.`)));
  if (hasSession) return NextResponse.next();

  const url = new URL("/sign-in", req.nextUrl.origin);
  if (req.nextUrl.pathname !== "/") url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Public: sign-in, first-run setup, Auth.js endpoints, cron (own secret), static assets.
  matcher: ["/((?!sign-in|setup|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
