import type { BrowserContext, Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import postgres from "postgres";
import { E2E_DATABASE_URL, E2E_SECRET } from "../playwright.config";

export const MARKERS = {
  privateNote: "PRIVATE-NOTE-e2e-7f3a-never-leak",
  sharedNote: "SHARED-NOTE-e2e-91c2-visible",
};

export const sql = postgres(E2E_DATABASE_URL);

/** Signs the browser in as `email` by minting the Auth.js session cookie with the test secret. */
export async function signInAs(context: BrowserContext, email: string) {
  const cookieName = "authjs.session-token";
  const value = await encode({ token: { email, sub: email }, secret: E2E_SECRET, salt: cookieName });
  await context.addCookies([{ name: cookieName, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

export async function personByRole(role: "employee" | "manager" | "hr_admin", where = sql``) {
  const [p] = await sql<{ id: string; name: string; email: string }[]>`
    select id, name, email from people where role = ${role} ${where} order by name limit 1`;
  return p;
}

/** Records every response body the page receives (HTML, RSC payloads, server action results). */
export function captureBodies(page: Page) {
  const bodies: string[] = [];
  page.on("response", async (res) => {
    try {
      bodies.push(await res.text());
    } catch {
      // Redirects and aborted requests have no body.
    }
  });
  return bodies;
}
