import { Role } from "@prisma/client";
import { requireRoles } from "@/lib/session";

/**
 * Example API-layer RBAC guard — used by route handlers / server actions.
 * Returns 403 JSON when the session role is not allowed.
 */
export async function assertApiRoles(allowed: Role[]) {
  try {
    return await requireRoles(allowed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ERROR";
    if (message === "UNAUTHORIZED") {
      return { error: "UNAUTHORIZED" as const, status: 401 as const };
    }
    return { error: "FORBIDDEN" as const, status: 403 as const };
  }
}
