import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getHomePathForRole } from "@/lib/rbac";
import type { AppRole } from "@/lib/roles";

/**
 * Root is a role-aware redirect hub.
 * Middleware also redirects `/` — this is a server-side fallback.
 */
export default async function RootRedirectPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  redirect(getHomePathForRole(session.user.role as AppRole));
}
