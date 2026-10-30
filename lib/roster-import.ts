// Roster CSV import: validation only (pure, unit-tested). lib/roster-import-apply.ts writes.
import { parseCsv } from "@/lib/csv";

export const IMPORT_COLUMNS = ["employee_code", "name", "email", "department", "team", "manager_email", "role"] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export const IMPORT_MAX_ROWS = 5000;

const ROLES = ["employee", "manager", "hr_admin"] as const;
type Role = (typeof ROLES)[number];

export type ImportRow = {
  line: number;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  team: string;
  managerEmail: string;
  role: Role;
};

export type RowResult = {
  /** 1-based line number in the file (the header is line 1). */
  line: number;
  values: Record<ImportColumn, string>;
  errors: string[];
  action: "create" | "update" | "unchanged" | null;
};

export type ExistingPerson = {
  employeeCode: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  team: string | null;
  active: boolean;
  isSample: boolean;
};

export type ImportPreview = {
  headerError: string | null;
  rows: RowResult[];
  valid: ImportRow[];
  summary: { total: number; valid: number; invalid: number; create: number; update: number; unchanged: number };
};

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const CODE = /^[A-Za-z0-9._-]{1,32}$/;

const normalizeRole = (raw: string) => raw.trim().toLowerCase().replace(/[\s-]+/g, "_");

/**
 * Validates an uploaded roster against the current one. Rows are matched to existing people by
 * employee_code. `viewerEmail` is the importing HR admin, who can't remove their own access.
 */
export function validateImport(text: string, existing: ExistingPerson[], viewerEmail: string): ImportPreview {
  const empty = { total: 0, valid: 0, invalid: 0, create: 0, update: 0, unchanged: 0 };
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const missing = IMPORT_COLUMNS.filter((c) => !header.includes(c));
  if (!table.length || missing.length) {
    return {
      headerError: `The first row must name these columns: ${IMPORT_COLUMNS.join(",")}. Missing: ${missing.join(", ") || "all"}.`,
      rows: [],
      valid: [],
      summary: empty,
    };
  }
  const body = table
    .slice(1)
    .map((cells, i) => ({ cells, line: i + 2 }))
    .filter(({ cells }) => cells.some((c) => c.trim() !== ""));
  if (body.length > IMPORT_MAX_ROWS) {
    return {
      headerError: `The file has ${body.length} rows; the limit is ${IMPORT_MAX_ROWS}. Split it into smaller files.`,
      rows: [],
      valid: [],
      summary: empty,
    };
  }

  const byCode = new Map(existing.map((p) => [p.employeeCode.toLowerCase(), p]));
  const byEmail = new Map(existing.map((p) => [p.email.toLowerCase(), p]));
  const col = (name: ImportColumn) => header.indexOf(name);

  // Pass 1: field-level checks.
  const firstLineOfCode = new Map<string, number>();
  const firstLineOfEmail = new Map<string, number>();
  const rows: (RowResult & { parsed: ImportRow | null })[] = body.map(({ cells, line }) => {
    const values = Object.fromEntries(
      IMPORT_COLUMNS.map((c) => [c, (cells[col(c)] ?? "").trim()]),
    ) as Record<ImportColumn, string>;
    const errors: string[] = [];
    const required: ImportColumn[] = ["employee_code", "name", "email", "department", "team", "role"];
    for (const c of required) if (!values[c]) errors.push(`${c} is required`);

    const code = values.employee_code;
    const email = values.email.toLowerCase();
    const managerEmail = values.manager_email.toLowerCase();
    const role = normalizeRole(values.role) as Role;

    if (code && !CODE.test(code)) errors.push("employee_code may only use letters, numbers, . _ - (max 32)");
    if (values.email && !EMAIL.test(email)) errors.push(`"${values.email}" isn’t a valid email`);
    if (managerEmail && !EMAIL.test(managerEmail)) errors.push(`manager_email "${values.manager_email}" isn’t a valid email`);
    if (values.role && !ROLES.includes(role)) errors.push(`role must be employee, manager or hr_admin (got "${values.role}")`);
    if (values.name.length > 120) errors.push("name is longer than 120 characters");
    if (values.department.length > 100 || values.team.length > 100) errors.push("department and team names are limited to 100 characters");

    if (code) {
      const seen = firstLineOfCode.get(code.toLowerCase());
      if (seen) errors.push(`employee_code ${code} is also on line ${seen}`);
      else firstLineOfCode.set(code.toLowerCase(), line);
    }
    if (email) {
      const seen = firstLineOfEmail.get(email);
      if (seen) errors.push(`${email} is also on line ${seen}`);
      else firstLineOfEmail.set(email, line);
    }

    const match = code ? byCode.get(code.toLowerCase()) : undefined;
    if (match?.isSample) errors.push(`${code} belongs to a sample person; remove sample data first or use another ID`);
    const emailOwner = email ? byEmail.get(email) : undefined;
    if (emailOwner && emailOwner.employeeCode.toLowerCase() !== code.toLowerCase()) {
      errors.push(`${email} already belongs to ${emailOwner.name} (${emailOwner.employeeCode})`);
    }
    if (email === viewerEmail.toLowerCase() && ROLES.includes(role) && role !== "hr_admin") {
      errors.push("You can’t remove your own HR admin role in an import");
    }

    const parsed: ImportRow | null = errors.length
      ? null
      : {
          line,
          employeeCode: code,
          name: values.name,
          email,
          department: values.department,
          team: values.team,
          managerEmail,
          role,
        };
    return { line, values, errors, action: null, parsed };
  });

  // Pass 2: managers. A manager must be a valid row in this file or an active person on the roster,
  // must have the manager or HR admin role, and every row of a team must name the same manager.
  const roleByEmail = new Map<string, Role>();
  for (const p of existing) if (p.active && !p.isSample) roleByEmail.set(p.email.toLowerCase(), p.role);
  for (const r of rows) if (r.parsed) roleByEmail.set(r.parsed.email, r.parsed.role);
  const teamManager = new Map<string, { email: string; line: number }>();
  for (const r of rows) {
    const p = r.parsed;
    if (!p || !p.managerEmail) continue;
    const managerRole = roleByEmail.get(p.managerEmail);
    if (!managerRole) {
      r.errors.push(`Manager ${p.managerEmail} isn’t in this file or on the roster`);
    } else if (managerRole === "employee") {
      r.errors.push(`Manager ${p.managerEmail} has the employee role; make them a manager`);
    }
    const key = `${p.department.toLowerCase()}\u0000${p.team.toLowerCase()}`;
    const first = teamManager.get(key);
    if (!first) teamManager.set(key, { email: p.managerEmail, line: p.line });
    else if (first.email !== p.managerEmail) {
      r.errors.push(`Team ${p.team} already has manager ${first.email} (line ${first.line})`);
    }
    if (r.errors.length) r.parsed = null;
  }

  // Actions for valid rows.
  const summary = { ...empty, total: rows.length };
  for (const r of rows) {
    if (!r.parsed) {
      summary.invalid++;
      continue;
    }
    summary.valid++;
    const p = r.parsed;
    const match = byCode.get(p.employeeCode.toLowerCase());
    if (!match) r.action = "create";
    else if (
      match.name === p.name &&
      match.email.toLowerCase() === p.email &&
      match.role === p.role &&
      (match.department ?? "").toLowerCase() === p.department.toLowerCase() &&
      (match.team ?? "").toLowerCase() === p.team.toLowerCase() &&
      match.active
    ) {
      r.action = "unchanged";
    } else {
      r.action = "update";
    }
    summary[r.action]++;
  }

  return {
    headerError: null,
    rows: rows.map((r) => ({ line: r.line, values: r.values, errors: r.errors, action: r.action })),
    valid: rows.flatMap((r) => (r.parsed ? [r.parsed] : [])),
    summary,
  };
}
