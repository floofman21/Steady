import { expect, test } from "@playwright/test";
import { E2E_CRON_SECRET } from "../playwright.config";
import { personByRole, signInAs, sql } from "./helpers";

const HEADER = "employee_code,name,email,department,team,manager_email,role";

test.describe("People admin", () => {
  test.beforeEach(async ({ context }) => {
    const hr = await personByRole("hr_admin");
    await signInAs(context, hr.email);
  });

  test.afterAll(async () => {
    await sql`delete from people where employee_code like 'IMP-%'`;
    await sql`delete from departments where name = 'Imported Dept'`;
  });

  test("a 200-row CSV with 3 bad rows shows those errors and commits nothing until confirmed", async ({ page }) => {
    const lines = [HEADER, "IMP-0000,Ivy Lead,ivy.lead@example.com,Imported Dept,Imported Team,,manager"];
    for (let i = 1; i < 200; i++) {
      const n = String(i).padStart(4, "0");
      lines.push(`IMP-${n},Person ${n},person.${n}@example.com,Imported Dept,Imported Team,ivy.lead@example.com,employee`);
    }
    lines[51] = "IMP-0050,Bad Email,not-an-email,Imported Dept,Imported Team,,employee"; // line 52
    lines[101] = "IMP-0100,Bad Role,bad.role@example.com,Imported Dept,Imported Team,,boss"; // line 102
    lines[151] = "IMP-0150,,no.name@example.com,Imported Dept,Imported Team,,employee"; // line 152
    const before = await sql`select count(*)::int as n from people`;

    await page.goto("/admin/people");
    await page.getByRole("button", { name: "Import CSV" }).click();
    await page.getByLabel("CSV file").setInputFiles({
      name: "roster.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(lines.join("\n")),
    });
    await expect(page.getByText("3 rows need fixing")).toBeVisible();
    const errorRows = page.getByRole("dialog").locator("tbody tr");
    await expect(errorRows).toHaveCount(3);
    await expect(errorRows.nth(0)).toContainText("52");
    await expect(errorRows.nth(0)).toContainText("isn’t a valid email");
    await expect(errorRows.nth(1)).toContainText("102");
    await expect(errorRows.nth(1)).toContainText("role must be");
    await expect(errorRows.nth(2)).toContainText("152");
    await expect(errorRows.nth(2)).toContainText("name is required");

    // Previewing wrote nothing.
    expect((await sql`select count(*)::int as n from people`)[0].n).toBe(before[0].n);

    await page.getByRole("button", { name: "Import 197 rows, skip 3" }).click();
    await expect(page.getByText(/Imported: 197 added/)).toBeVisible();
    expect((await sql`select count(*)::int as n from people`)[0].n).toBe(before[0].n + 197);
    const [team] = await sql`select t.name, m.email from teams t join people m on m.id = t.manager_id where t.name = 'Imported Team'`;
    expect(team.email).toBe("ivy.lead@example.com");
  });

  test("roles, activation and check-in deletion are editable; your own role isn’t", async ({ page }) => {
    const hr = await personByRole("hr_admin");
    const [target] = await sql<{ id: string; name: string }[]>`
      select p.id, p.name from people p where p.role = 'employee' and p.employee_code like 'EMP-%'
        and exists (select 1 from checkins c where c.person_id = p.id) order by p.name desc limit 1`;
    await page.goto("/admin/people");

    await page.getByLabel(`Role for ${target.name}`).selectOption("manager");
    await expect(page.getByText(`${target.name} is now a manager.`)).toBeVisible();
    expect((await sql`select role from people where id = ${target.id}`)[0].role).toBe("manager");
    await page.getByLabel(`Role for ${target.name}`).selectOption("employee");
    await expect(page.getByText(`${target.name} is now an employee.`)).toBeVisible();

    await page.getByRole("button", { name: `Actions for ${target.name}` }).click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await expect(page.getByText(`${target.name} is deactivated`)).toBeVisible();
    expect((await sql`select active from people where id = ${target.id}`)[0].active).toBe(false);
    await page.getByLabel(/Show \d+ deactivated/).check();
    await page.getByRole("button", { name: `Actions for ${target.name}` }).click();
    await page.getByRole("menuitem", { name: "Reactivate" }).click();
    await expect(page.getByText(`${target.name} is active again.`)).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Actions for ${target.name}` }).click();
    await page.getByRole("menuitem", { name: /Delete check-ins/ }).click();
    await expect(page.getByText(new RegExp(`Deleted \\d+ check-ins? for ${target.name}`))).toBeVisible();
    expect((await sql`select count(*)::int as n from checkins where person_id = ${target.id}`)[0].n).toBe(0);
    expect((await sql`select 1 from audit_log where subject_id = ${target.id} and action = 'delete_checkins'`).length).toBe(1);

    const [me] = await sql<{ name: string }[]>`select name from people where email = ${hr.email}`;
    await expect(page.getByLabel(`Role for ${me.name}`)).toBeDisabled();
  });
});

test.describe("job routes", () => {
  for (const path of ["/api/cron/reminders", "/api/cron/digest"]) {
    test(`${path} returns 401 without CRON_SECRET`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(401);
      expect((await request.get(path, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
    });

    test(`${path} reports recipients with the secret (dry run)`, async ({ request }) => {
      const res = await request.get(`${path}?force=1&dryRun=1`, { headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` } });
      expect(res.status()).toBe(200);
      const { reports } = await res.json();
      expect(reports[0]).toMatchObject({ org: "Arkone", status: "dry_run" });
    });
  }

  test("reminders skip sample people and people who already checked in", async ({ request }) => {
    const res = await request.get("/api/cron/reminders?force=1&dryRun=1", { headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` } });
    const { reports } = await res.json();
    // The e2e roster is all sample people (from the seed), so nobody is emailed.
    expect(reports[0].recipients).toBe(0);
  });
});
