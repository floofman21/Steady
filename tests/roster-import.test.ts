import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { validateImport, type ExistingPerson } from "@/lib/roster-import";

const HEADER = "employee_code,name,email,department,team,manager_email,role";
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

const existing: ExistingPerson[] = [
  { employeeCode: "EMP-0001", email: "admin@acme.com", name: "Ada Admin", role: "hr_admin", department: null, team: null, active: true, isSample: false },
  { employeeCode: "EMP-0100", email: "mia@acme.com", name: "Mia Manager", role: "manager", department: "Sales", team: "East", active: true, isSample: false },
  { employeeCode: "SMP-1041", email: "priya.sharma@example.com", name: "Priya Sharma", role: "manager", department: "Engineering", team: "Platform", active: true, isSample: true },
];
const run = (text: string) => validateImport(text, existing, "admin@acme.com");

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
  it("keeps line breaks inside quoted fields", () => {
    expect(parseCsv('a\n"line 1\nline 2"')).toEqual([["a"], ["line 1\nline 2"]]);
  });
});

describe("validateImport", () => {
  it("rejects a file without the required columns", () => {
    const r = run("name,email\nAna,ana@acme.com");
    expect(r.headerError).toMatch(/Missing: employee_code, department, team, manager_email, role/);
  });

  it("accepts columns in any order and any case, and plans creates and updates", () => {
    const r = run(
      [
        "Role,EMAIL,name,employee_code,team,department,manager_email",
        "employee,ana@acme.com,Ana,EMP-0200,East,Sales,mia@acme.com",
        "manager,mia@acme.com,Mia Manager,EMP-0100,West,Sales,",
      ].join("\n"),
    );
    expect(r.headerError).toBeNull();
    expect(r.summary).toMatchObject({ total: 2, valid: 2, invalid: 0, create: 1, update: 1 });
  });

  it("marks unchanged rows", () => {
    const r = run(csv("EMP-0100,Mia Manager,mia@acme.com,Sales,East,,manager"));
    expect(r.summary.unchanged).toBe(1);
  });

  it("reports row-level errors with line numbers and keeps good rows", () => {
    const r = run(
      csv(
        "EMP-0200,Ana,ana@acme.com,Sales,East,mia@acme.com,employee",
        "EMP-0201,,bad-email,Sales,East,,boss",
        "EMP-0200,Dup,dup@acme.com,Sales,East,,employee",
        "EMP-0202,Ben,mia@acme.com,Sales,East,,employee",
        "SMP-1041,Priya,priya@acme.com,Eng,Platform,,manager",
        "EMP-0203,Cy,cy@acme.com,Sales,East,nobody@acme.com,employee",
        "EMP-0204,Di,di@acme.com,Sales,East,ana@acme.com,employee",
      ),
    );
    const errs = Object.fromEntries(r.rows.map((x) => [x.line, x.errors.join(" | ")]));
    expect(errs[2]).toBe("");
    expect(errs[3]).toMatch(/name is required/);
    expect(errs[3]).toMatch(/isn’t a valid email/);
    expect(errs[3]).toMatch(/role must be/);
    expect(errs[4]).toMatch(/also on line 2/);
    expect(errs[5]).toMatch(/already belongs to Mia Manager/);
    expect(errs[6]).toMatch(/sample person/);
    expect(errs[7]).toMatch(/isn’t in this file or on the roster/);
    expect(errs[8]).toMatch(/has the employee role/);
    expect(r.summary).toMatchObject({ total: 7, valid: 1, invalid: 6 });
    expect(r.valid.map((v) => v.employeeCode)).toEqual(["EMP-0200"]);
  });

  it("requires one manager per team", () => {
    const r = run(
      csv(
        "EMP-0300,Max,max@acme.com,Ops,Core,,manager",
        "EMP-0301,Ann,ann@acme.com,Ops,Core,mia@acme.com,employee",
        "EMP-0302,Bo,bo@acme.com,Ops,Core,max@acme.com,employee",
      ),
    );
    expect(r.rows.find((x) => x.line === 4)!.errors.join()).toMatch(/already has manager mia@acme.com \(line 3\)/);
  });

  it("won’t let the importing HR admin remove their own access", () => {
    const r = run(csv("EMP-0001,Ada Admin,admin@acme.com,HR,People,,employee"));
    expect(r.rows[0].errors.join()).toMatch(/your own HR admin role/);
  });

  it("normalizes roles and lowercases emails", () => {
    const r = run(csv("EMP-0400,Hal,Hal@Acme.com,HR,People,,HR Admin"));
    expect(r.valid[0]).toMatchObject({ email: "hal@acme.com", role: "hr_admin" });
  });

  it("skips blank lines without shifting line numbers", () => {
    const r = run(csv("", "EMP-0500,Ivy,ivy@acme.com,HR,People,,employee"));
    expect(r.rows[0].line).toBe(3);
  });
});
