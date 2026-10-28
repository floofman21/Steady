import { expect, test } from "@playwright/test";
import { captureBodies, MARKERS, personByRole, signInAs, sql } from "./helpers";

test.describe("access control", () => {
  test("signed-out visitors are sent to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Fdashboard/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("an employee cannot open the dashboard, feed or people admin", async ({ page, context }) => {
    const employee = await personByRole("employee");
    await signInAs(context, employee.email);
    for (const path of ["/dashboard", "/feed", "/admin/people"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/check-in$/);
    }
    await expect(page.getByRole("link", { name: "Health Dashboard" })).toHaveCount(0);
  });

  test("someone not on the roster is told to ask HR", async ({ page, context }) => {
    await signInAs(context, "stranger@example.com");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByText("Ask HR to add you to Steady")).toBeVisible();
  });

  test("a manager sees only their direct reports", async ({ page, context }) => {
    const [manager] = await sql<{ id: string; email: string }[]>`
      select p.id, p.email from people p join teams t on t.manager_id = p.id where t.name = 'Platform'`;
    const reports = await sql<{ name: string }[]>`
      select p.name from people p join teams t on t.id = p.team_id
      where t.manager_id = ${manager.id} and p.id <> ${manager.id} order by p.name`;
    await signInAs(context, manager.email);
    await page.goto("/dashboard?per=50&sort=name");
    const names = await page.locator("#people tbody tr td:nth-child(2)").allInnerTexts();
    expect(names.map((n) => n.replace(/^[A-Z]{1,2}\s*/, "").trim()).sort()).toEqual(reports.map((r) => r.name));

    // Someone outside the team can't be opened by URL, and nothing is logged.
    const [outsider] = await sql<{ id: string }[]>`
      select p.id from people p join teams t on t.id = p.team_id where t.name = 'Enterprise' limit 1`;
    await page.goto(`/dashboard?person=${outsider.id}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const logged = await sql`select 1 from audit_log where actor_id = ${manager.id} and subject_id = ${outsider.id}`;
    expect(logged.length).toBe(0);
  });

  test("private notes never reach anyone but their author", async ({ browser }) => {
    const [{ person_id: authorId }] = await sql<{ person_id: string }[]>`
      select person_id from checkins where note = ${MARKERS.privateNote}`;
    const [manager] = await sql<{ email: string }[]>`
      select m.email from people a join teams t on t.id = a.team_id join people m on m.id = t.manager_id
      where a.id = ${authorId}`;
    const hr = await personByRole("hr_admin");

    // A fresh browser context per viewer, so no late response can carry one session into another.
    for (const viewer of [manager.email, hr.email]) {
      const context = await browser.newContext();
      await signInAs(context, viewer);
      const page = await context.newPage();
      const bodies = captureBodies(page);
      for (const path of ["/dashboard", `/dashboard?person=${authorId}`, "/feed", "/feed?shared=1"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
      }
      // Open a drawer through the UI too, to cover client navigations.
      await page.goto("/dashboard?per=50");
      await page.locator("#people tbody tr").first().click();
      await page.waitForLoadState("networkidle");
      expect(bodies.length).toBeGreaterThan(4);
      expect(bodies.join("\n")).not.toContain(MARKERS.privateNote);
      // A shared note by the same author does come through.
      await page.goto("/feed");
      await expect(page.getByText(MARKERS.sharedNote)).toBeVisible();
      await context.close();
    }

    // The author still sees their own private note.
    const [author] = await sql<{ email: string }[]>`select email from people where id = ${authorId}`;
    const context = await browser.newContext();
    await signInAs(context, author.email);
    const page = await context.newPage();
    await page.goto("/check-in");
    await expect(page.locator("#note")).toHaveValue(MARKERS.privateNote);
    await context.close();
  });

  test("opening a person writes the audit log", async ({ page, context }) => {
    const hr = await personByRole("hr_admin");
    const [subject] = await sql<{ id: string }[]>`select id from people where role = 'employee' order by name limit 1`;
    await signInAs(context, hr.email);
    await page.goto(`/dashboard?person=${subject.id}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    const rows = await sql`select 1 from audit_log a join people p on p.id = a.actor_id
      where p.email = ${hr.email} and a.subject_id = ${subject.id}`;
    expect(rows.length).toBeGreaterThan(0);
  });
});
