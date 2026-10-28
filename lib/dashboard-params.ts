// Dashboard URL params. Safe to import from client components.
import { z } from "zod";

export const SORT_KEYS = ["name", "id", "dept", "burnout", "happiness", "stress", "engagement", "last"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const PER_PAGE = [10, 20, 50] as const;

const paramsSchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  dept: z.string().trim().max(100).catch("").default(""),
  risk: z.preprocess((v) => v === "1" || v === "true", z.boolean()).catch(false),
  sort: z.enum(SORT_KEYS).catch("burnout").default("burnout"),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  per: z.coerce
    .number()
    .refine((n) => (PER_PAGE as readonly number[]).includes(n))
    .catch(10)
    .default(10),
  person: z.uuid().optional().catch(undefined),
});

export type DashboardParams = z.infer<typeof paramsSchema> & { dir: "asc" | "desc" };

/** Text columns sort A→Z by default; metrics and recency sort high→low. */
export function defaultDir(sort: SortKey): "asc" | "desc" {
  return sort === "name" || sort === "id" || sort === "dept" ? "asc" : "desc";
}

export function parseParams(raw: Record<string, string | string[] | undefined>): DashboardParams {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const p = paramsSchema.parse(flat);
  return { ...p, dir: p.dir ?? defaultDir(p.sort) };
}
