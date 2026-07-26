/**
 * Shared role constants — safe for Edge middleware (no Prisma import).
 * Keep in sync with Prisma `enum Role`.
 */
export const ROLES = [
  "internal_specialist",
  "admin",
  "freight_forwarder",
  "customs_agency",
  "supplier",
] as const;

export type AppRole = (typeof ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
